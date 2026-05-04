/**
 * TechnicianService — Workforce management business logic.
 *
 * Mirrors OrderService layering: routes call the service, the service throws
 * typed errors, the global error handler maps to HTTP. Status enum is
 * enforced here (no DB-level CHECK because SQLite ALTER ADD COLUMN can't
 * carry one). Soft-delete blocks while open work is assigned. Workload
 * counts are derived per-technician — kept SEPARATE from ITEMS_WITH_TECH_SQL
 * so order-item reads don't recompute aggregates per row.
 */

const { db } = require('../db');
const {
  TechnicianHasAssignmentsError,
  ValidationError,
  InvalidStatusError,
  NoSuitableTechnicianError,
  OrderLockedError,
} = require('../errors');

const STATUS_ENUM = ['available', 'busy', 'off_shift', 'on_leave'];

// "Open" assignments are items on orders that are neither locked
// (locked_at set on delivered) nor in a terminal side-branch.
const OPEN_ORDER_PREDICATE = `
  o.locked_at IS NULL
  AND o.status NOT IN ('cancelled', 'rejected', 'closed', 'delivered')
`;

function notFound(name, id) {
  const err = new Error(`${name} ${id} not found`);
  err.name = 'NotFoundError';
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal reads
// ─────────────────────────────────────────────────────────────────────────────

function readTechRow(id) {
  return db.prepare(`
    SELECT t.id, t.user_id, t.name, t.role_id, t.status, t.phone, t.notes,
           t.active, t.archived_at, t.created_at,
           r.value AS role_value, r.display_label_ar AS role_display_label_ar,
           u.username
    FROM technicians t
    LEFT JOIN roles r ON r.id = t.role_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(id);
}

function readSpecsForTech(techId, limit = null) {
  const sql = `
    SELECT s.id, s.value, s.display_label_ar
    FROM technician_specializations ts
    JOIN specializations s ON s.id = ts.specialization_id
    WHERE ts.technician_id = ?
    ORDER BY s.sort_order, s.id
    ${limit ? 'LIMIT ' + Number(limit) : ''}
  `;
  return db.prepare(sql).all(techId);
}

function readSpecsForTechs(techIds) {
  if (!techIds.length) return new Map();
  const placeholders = techIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT ts.technician_id, s.id, s.value, s.display_label_ar, s.sort_order
    FROM technician_specializations ts
    JOIN specializations s ON s.id = ts.specialization_id
    WHERE ts.technician_id IN (${placeholders})
    ORDER BY s.sort_order, s.id
  `).all(...techIds);
  const grouped = new Map();
  for (const id of techIds) grouped.set(id, []);
  for (const r of rows) {
    grouped.get(r.technician_id).push({
      id: r.id, value: r.value, display_label_ar: r.display_label_ar,
    });
  }
  return grouped;
}

function readRecentAssignments(techId, limit = 10) {
  return db.prepare(`
    SELECT oit.id AS assignment_id, oit.assigned_at, oit.completed_at,
           oi.id AS order_item_id, oi.item_name, oi.priority,
           o.id AS order_id, o.order_number, o.status, o.locked_at
    FROM order_item_technicians oit
    JOIN order_items oi ON oi.id = oit.order_item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE oit.technician_id = ?
    ORDER BY oit.id DESC
    LIMIT ?
  `).all(techId, limit);
}

// ─────────────────────────────────────────────────────────────────────────────
// Workload — separate from ITEMS_WITH_TECH_SQL by design.
// One round-trip aggregate, batched across N technicians.
// ─────────────────────────────────────────────────────────────────────────────

function getWorkload(techIds) {
  if (!Array.isArray(techIds) || techIds.length === 0) return {};
  const placeholders = techIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT oit.technician_id,
           COUNT(*) AS active_count,
           SUM(CASE WHEN oi.priority = 'urgent' THEN 1 ELSE 0 END) AS urgent_count
    FROM order_item_technicians oit
    JOIN order_items oi ON oi.id = oit.order_item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE oit.technician_id IN (${placeholders})
      AND ${OPEN_ORDER_PREDICATE}
    GROUP BY oit.technician_id
  `).all(...techIds);
  const out = {};
  for (const id of techIds) out[id] = { active_count: 0, urgent_count: 0 };
  for (const r of rows) {
    out[r.technician_id] = {
      active_count: r.active_count,
      urgent_count: r.urgent_count,
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public detail shape (used by GET /:id)
// ─────────────────────────────────────────────────────────────────────────────

function getDetail(id) {
  const tech = readTechRow(id);
  if (!tech) throw notFound('Technician', id);
  const specializations = readSpecsForTech(id);
  const recent_assignments = readRecentAssignments(id, 10);
  const workload = getWorkload([id])[id];
  return { ...tech, specializations, recent_assignments, ...workload };
}

// ─────────────────────────────────────────────────────────────────────────────
// List with filters / pagination / optional workload
// ─────────────────────────────────────────────────────────────────────────────

function list({
  role_id = null,
  status = null,
  search = null,
  active = null,
  include_archived = false,
  withWorkload = false,
  limit = 20,
  offset = 0,
} = {}) {
  const safeLimit  = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const where = [];
  const params = [];

  if (role_id != null) {
    where.push('t.role_id = ?');
    params.push(parseInt(role_id, 10));
  }
  if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (active != null) {
    where.push('t.active = ?');
    params.push(active === '0' || active === 0 || active === false ? 0 : 1);
  }
  if (search) {
    where.push('t.name LIKE ? COLLATE NOCASE');
    params.push(`%${search}%`);
  }
  if (!include_archived) {
    where.push('t.archived_at IS NULL');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM technicians t ${whereSql}`).get(...params).n;

  const rows = db.prepare(`
    SELECT t.id, t.user_id, t.name, t.role_id, t.status, t.phone, t.active,
           t.created_at,
           r.value AS role_value, r.display_label_ar AS role_display_label_ar,
           u.username
    FROM technicians t
    LEFT JOIN roles r ON r.id = t.role_id
    LEFT JOIN users u ON u.id = t.user_id
    ${whereSql}
    ORDER BY t.active DESC, t.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, safeLimit, safeOffset);

  const ids = rows.map(r => r.id);
  const specsByTech = readSpecsForTechs(ids);
  const workloadByTech = withWorkload ? getWorkload(ids) : null;

  const items = rows.map(r => {
    const specs = specsByTech.get(r.id) || [];
    const out = { ...r, specializations_top3: specs.slice(0, 3) };
    if (workloadByTech) {
      const w = workloadByTech[r.id] || { active_count: 0, urgent_count: 0 };
      out.active_count = w.active_count;
      out.urgent_count = w.urgent_count;
    }
    return out;
  });

  return { items, total, limit: safeLimit, offset: safeOffset };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / update / softDelete
// ─────────────────────────────────────────────────────────────────────────────

function validateName(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('الاسم مطلوب');
  }
  return name.trim();
}

function validateStatus(status) {
  if (!STATUS_ENUM.includes(status)) {
    throw new InvalidStatusError(status);
  }
  return status;
}

const _create = db.transaction((data) => {
  const result = db.prepare(`
    INSERT INTO technicians (user_id, name, role_id, phone, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    data.user_id ?? null,
    data.name,
    data.role_id ?? null,
    data.phone ?? null,
    data.notes ?? null,
  );
  const id = result.lastInsertRowid;
  if (Array.isArray(data.specialization_ids) && data.specialization_ids.length) {
    const ins = db.prepare(`
      INSERT OR IGNORE INTO technician_specializations
        (technician_id, specialization_id) VALUES (?, ?)
    `);
    for (const specId of data.specialization_ids) {
      ins.run(id, parseInt(specId, 10));
    }
  }
  return id;
});

function create(data) {
  const name = validateName(data.name);
  const id = _create({ ...data, name });
  return getDetail(id);
}

const ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'role_id', 'phone', 'notes', 'status', 'active',
]);

function update(id, data) {
  const tech = readTechRow(id);
  if (!tech) throw notFound('Technician', id);

  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(data)) {
    if (!ALLOWED_UPDATE_FIELDS.has(k)) continue;
    if (k === 'name') {
      sets.push('name = ?');
      params.push(validateName(v));
    } else if (k === 'status') {
      sets.push('status = ?');
      params.push(validateStatus(v));
    } else if (k === 'active') {
      sets.push('active = ?');
      params.push(v ? 1 : 0);
    } else {
      sets.push(`${k} = ?`);
      params.push(v ?? null);
    }
  }

  if (sets.length === 0) return getDetail(id);

  params.push(id);
  db.prepare(`UPDATE technicians SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return getDetail(id);
}

function countOpenAssignments(techId) {
  const row = db.prepare(`
    SELECT COUNT(*) AS n
    FROM order_item_technicians oit
    JOIN order_items oi ON oi.id = oit.order_item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE oit.technician_id = ?
      AND ${OPEN_ORDER_PREDICATE}
  `).get(techId);
  return row?.n ?? 0;
}

function softDelete(id) {
  const tech = readTechRow(id);
  if (!tech) throw notFound('Technician', id);
  const open = countOpenAssignments(id);
  if (open > 0) throw new TechnicianHasAssignmentsError(open);
  db.prepare(`UPDATE technicians SET active = 0 WHERE id = ?`).run(id);
  return getDetail(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Specialization assignment (M:M, idempotent)
// ─────────────────────────────────────────────────────────────────────────────

function addSpecialization(techId, specId) {
  const tech = readTechRow(techId);
  if (!tech) throw notFound('Technician', techId);
  const spec = db.prepare(`SELECT id FROM specializations WHERE id = ?`).get(specId);
  if (!spec) throw notFound('Specialization', specId);
  db.prepare(`
    INSERT OR IGNORE INTO technician_specializations
      (technician_id, specialization_id) VALUES (?, ?)
  `).run(techId, specId);
  return readSpecsForTech(techId);
}

function removeSpecialization(techId, specId) {
  const tech = readTechRow(techId);
  if (!tech) throw notFound('Technician', techId);
  db.prepare(`
    DELETE FROM technician_specializations
    WHERE technician_id = ? AND specialization_id = ?
  `).run(techId, specId);
  return readSpecsForTech(techId);
}

// ─────────────────────────────────────────────────────────────────────────────
// WF-2: Picker query + suggestion engine
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// WF-4: DB-backed item-type → specialization map with 60-second TTL cache.
// Source of truth is the item_type_spec_map table (seeded in db.js).
// The legacy constant below is kept only for backwards-compat exports.
// ─────────────────────────────────────────────────────────────────────────────

let _specMapCache = null;

function getItemTypeSpecMap() {
  const now = Date.now();
  if (_specMapCache && (now - _specMapCache.cachedAt) < 60_000) {
    return _specMapCache.map;
  }
  const rows = db.prepare('SELECT item_type, spec_values FROM item_type_spec_map').all();
  const map = new Map();
  for (const row of rows) {
    try { map.set(row.item_type, JSON.parse(row.spec_values)); }
    catch { map.set(row.item_type, []); }
  }
  _specMapCache = { map, cachedAt: now };
  return map;
}

function _invalidateSpecMapCache() {
  _specMapCache = null;
}

// Upsert one item-type → spec-values row. Validates against active specializations.
// Throws ValidationError on unknown spec value.
function updateItemTypeSpecMap(itemType, specValues, updatedBy = null) {
  if (!itemType || typeof itemType !== 'string') throw new ValidationError('item_type مطلوب');
  if (!Array.isArray(specValues)) throw new ValidationError('spec_values يجب أن يكون مصفوفة');

  if (specValues.length > 0) {
    const known = new Set(
      db.prepare('SELECT value FROM specializations WHERE active = 1').all().map(r => r.value)
    );
    const unknown = specValues.filter(v => !known.has(v));
    if (unknown.length) throw new ValidationError(`تخصصات غير معروفة: ${unknown.join(', ')}`);
  }

  const safeUpdatedBy = updatedBy != null
    ? (db.prepare('SELECT 1 FROM users WHERE id = ?').get(updatedBy) ? updatedBy : null)
    : null;

  db.prepare(`
    INSERT INTO item_type_spec_map (item_type, spec_values, updated_by, updated_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(item_type) DO UPDATE SET
      spec_values = excluded.spec_values,
      updated_by  = excluded.updated_by,
      updated_at  = excluded.updated_at
  `).run(itemType, JSON.stringify(specValues), safeUpdatedBy);

  _invalidateSpecMapCache();

  return db.prepare(`
    SELECT m.*, u.username AS updated_by_username
    FROM item_type_spec_map m
    LEFT JOIN users u ON u.id = m.updated_by
    WHERE m.item_type = ? COLLATE NOCASE
  `).get(itemType);
}

// Backwards-compat: kept so existing imports/tests still resolve.
const ITEM_TYPE_SPEC_MAP = {
  'خاتم': ['rings'],
  'حلق':  ['earrings'],
  'قرط':  ['earrings'],
  'سوار': ['bracelets'],
  'عقد':  ['chains'],
  'دبلة': ['rings'],
  'ساعة': ['watches'],
};

const STATUS_SCORE = {
  available:  5,
  busy:       0,
  off_shift: -10,
  on_leave:  -20,
};

// Workload subquery shared between pickerQuery and suggestForItem.
const WORKLOAD_SUBQUERY = `
  (
    SELECT oit.technician_id, COUNT(*) AS active_count
    FROM order_item_technicians oit
    JOIN order_items oi ON oi.id = oit.order_item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE ${OPEN_ORDER_PREDICATE}
    GROUP BY oit.technician_id
  )
`;

// ─────────────────────────────────────────────────────────────────────────────
// pickerQuery — optimized minimal payload for the assignment picker UI.
// Sorted least-busy first, inactive techs excluded.
// status: default 'available'; pass 'all' to include all statuses.
// ─────────────────────────────────────────────────────────────────────────────

function pickerQuery({ q = null, specialization_id = null, status = null, limit = 30, offset = 0 } = {}) {
  const safeLimit  = Math.min(Math.max(parseInt(limit, 10)  || 30, 1), 100);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  // Build join + where clauses, keeping param order: [specJoin?, ...whereParams]
  const joinParams  = [];
  const whereParams = [];
  const where = ['t.active = 1'];

  const specJoin = specialization_id != null
    ? `INNER JOIN technician_specializations ts_filter
         ON ts_filter.technician_id = t.id AND ts_filter.specialization_id = ?`
    : '';
  if (specialization_id != null) joinParams.push(parseInt(specialization_id, 10));

  const statusFilter = status === 'all' ? null : (status || 'available');
  if (statusFilter) {
    where.push('t.status = ?');
    whereParams.push(statusFilter);
  }
  if (q) {
    where.push('t.name LIKE ? COLLATE NOCASE');
    whereParams.push(`%${q}%`);
  }

  const whereSql  = `WHERE ${where.join(' AND ')}`;
  const allParams = [...joinParams, ...whereParams];

  const total = db.prepare(`
    SELECT COUNT(DISTINCT t.id) AS n
    FROM technicians t
    ${specJoin}
    ${whereSql}
  `).get(...allParams).n;

  const rows = db.prepare(`
    SELECT t.id, t.name, t.status,
           r.value AS role_value, r.display_label_ar AS role_display_label_ar,
           COALESCE(wl.active_count, 0) AS active_count
    FROM technicians t
    ${specJoin}
    LEFT JOIN roles r ON r.id = t.role_id
    LEFT JOIN ${WORKLOAD_SUBQUERY} wl ON wl.technician_id = t.id
    ${whereSql}
    GROUP BY t.id
    ORDER BY active_count ASC, t.name ASC
    LIMIT ? OFFSET ?
  `).all(...allParams, safeLimit, safeOffset);

  const ids = rows.map(r => r.id);
  const specsByTech = readSpecsForTechs(ids);
  const items = rows.map(r => ({ ...r, specializations: specsByTech.get(r.id) || [] }));

  return { items, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// _scoreAndRank — pure scoring function; testable in isolation.
// techs: array of { id, name, status, active_count, specializations:[{value}] }
// matchedSpecValues: string[] from ITEM_TYPE_SPEC_MAP lookup
// ─────────────────────────────────────────────────────────────────────────────

function _scoreAndRank(techs, matchedSpecValues) {
  return techs
    .map(t => {
      const techSpecValues = t.specializations.map(s => s.value);
      const matched_specs  = matchedSpecValues.filter(v => techSpecValues.includes(v));
      const score =
        matched_specs.length * 10 +
        (STATUS_SCORE[t.status] ?? 0) +
        (t.active_count ?? 0) * -1;
      return { ...t, score, matched_specs };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ar'));
}

// ─────────────────────────────────────────────────────────────────────────────
// suggestForItem — rank active technicians by suitability for an order item.
// Throws NotFoundError if the item doesn't exist.
// ─────────────────────────────────────────────────────────────────────────────

function suggestForItem(itemId, { limit = 5 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);

  const item = db.prepare(`SELECT id, item_type FROM order_items WHERE id = ?`).get(itemId);
  if (!item) throw notFound('OrderItem', itemId);

  const matchedSpecValues = getItemTypeSpecMap().get(item.item_type) ?? [];

  const rows = db.prepare(`
    SELECT t.id, t.name, t.status,
           r.display_label_ar AS role_display_label_ar,
           COALESCE(wl.active_count, 0) AS active_count
    FROM technicians t
    LEFT JOIN roles r ON r.id = t.role_id
    LEFT JOIN ${WORKLOAD_SUBQUERY} wl ON wl.technician_id = t.id
    WHERE t.active = 1
  `).all();

  const ids = rows.map(r => r.id);
  const specsByTech = readSpecsForTechs(ids);
  const techs = rows.map(r => ({ ...r, specializations: specsByTech.get(r.id) || [] }));

  const ranked = _scoreAndRank(techs, matchedSpecValues);

  return {
    item_id:                item.id,
    item_type:              item.item_type,
    matched_specializations: matchedSpecValues,
    suggestions:            ranked.slice(0, safeLimit),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WF-4: autoAssign — score active techs and atomically assign the top result.
// 422 NoSuitableTechnicianError when no active techs exist.
// 409 OrderLockedError when the order is locked.
// Forward-compat: writes assignment_method='auto' to assignment_history if that
// table+column exist (analytics plan Phase 2 Group B — silently skipped otherwise).
// ─────────────────────────────────────────────────────────────────────────────

function autoAssign(orderItemId, { assignedBy = null } = {}) {
  const item = db.prepare(`
    SELECT oi.id, oi.item_type, oi.order_id, o.locked_at
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.id = ?
  `).get(orderItemId);
  if (!item) throw notFound('OrderItem', orderItemId);
  if (item.locked_at) throw new OrderLockedError();

  const result = suggestForItem(orderItemId, { limit: 1 });
  if (!result.suggestions.length) throw new NoSuitableTechnicianError();

  const top = result.suggestions[0];

  db.transaction(() => {
    db.prepare('DELETE FROM order_item_technicians WHERE order_item_id = ?').run(orderItemId);
    db.prepare(`
      INSERT INTO order_item_technicians (order_item_id, technician_id) VALUES (?, ?)
    `).run(orderItemId, top.id);

    const hasHistory = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='assignment_history'"
    ).get();
    if (hasHistory) {
      const hasMethodCol = db.prepare(
        "SELECT 1 FROM pragma_table_info('assignment_history') WHERE name='assignment_method'"
      ).get();
      if (hasMethodCol) {
        db.prepare(`
          INSERT INTO assignment_history (order_item_id, technician_id, assignment_method, assigned_by)
          VALUES (?, ?, 'auto', ?)
        `).run(orderItemId, top.id, assignedBy ?? null);
      }
    }
  })();

  const technician = db.prepare(
    'SELECT id, name, status, role_id FROM technicians WHERE id = ?'
  ).get(top.id);

  return { technician, score: top.score, matched_specs: top.matched_specs };
}

// ─────────────────────────────────────────────────────────────────────────────
// WF-3: Status change (with audit log) + workload summary
// ─────────────────────────────────────────────────────────────────────────────

// Status sort order for the workload summary board (available first → on_leave last).
const STATUS_SORT = { available: 0, busy: 1, off_shift: 2, on_leave: 3 };

// changeStatus — atomic: writes technician_status_log row + updates technicians.status.
// options: { reason?: string, changedBy?: number (users.id) }
// Throws NotFoundError (404) on bad techId; InvalidStatusError (422) on bad enum.
function changeStatus(techId, newStatus, { reason = null, changedBy = null } = {}) {
  const tech = readTechRow(techId);
  if (!tech) throw notFound('Technician', techId);
  validateStatus(newStatus);

  // Degrade to null if changedBy doesn't resolve to a real user row (deleted
  // user, synthetic test token, etc.) — prevents FK violation on the log INSERT.
  const safeChangedBy = changedBy != null
    ? (db.prepare('SELECT 1 FROM users WHERE id = ?').get(changedBy) ? changedBy : null)
    : null;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO technician_status_log (technician_id, from_status, to_status, changed_by, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(techId, tech.status, newStatus, safeChangedBy, reason ?? null);
    db.prepare(`UPDATE technicians SET status = ? WHERE id = ?`).run(newStatus, techId);
  })();

  return getDetail(techId);
}

// getWorkloadSummary — full roster snapshot for the live status board.
// options: { activeOnly: boolean = true }
// Sorted: available → busy → off_shift → on_leave, then name ASC.
// current_item: most recently assigned active item (by oit.id desc), or null.
function getWorkloadSummary({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE t.active = 1' : '';

  // Open-order predicate spelled out per-alias (OPEN_ORDER_PREDICATE uses `o.` prefix).
  const OPEN_WL = `
    o_wl.locked_at IS NULL
    AND o_wl.status NOT IN ('cancelled','rejected','closed','delivered')
  `;
  const OPEN_CI = `
    o_ci.locked_at IS NULL
    AND o_ci.status NOT IN ('cancelled','rejected','closed','delivered')
  `;

  const rows = db.prepare(`
    SELECT
      t.id, t.name, t.status,
      r.value          AS role_value,
      r.display_label_ar AS role_display_label_ar,
      COALESCE(wl.active_count, 0) AS active_count,
      COALESCE(wl.urgent_count, 0) AS urgent_count,
      ci.item_id       AS ci_item_id,
      ci.item_name     AS ci_item_name,
      ci.order_number  AS ci_order_number
    FROM technicians t
    LEFT JOIN roles r ON r.id = t.role_id
    LEFT JOIN (
      SELECT oit_wl.technician_id,
             COUNT(*)  AS active_count,
             SUM(CASE WHEN oi_wl.priority = 'urgent' THEN 1 ELSE 0 END) AS urgent_count
      FROM order_item_technicians oit_wl
      JOIN order_items oi_wl ON oi_wl.id = oit_wl.order_item_id
      JOIN orders o_wl       ON o_wl.id  = oi_wl.order_id
      WHERE ${OPEN_WL}
      GROUP BY oit_wl.technician_id
    ) wl ON wl.technician_id = t.id
    LEFT JOIN (
      SELECT oit_ci.technician_id,
             oi_ci.id          AS item_id,
             oi_ci.item_name,
             o_ci.order_number
      FROM order_item_technicians oit_ci
      JOIN order_items oi_ci ON oi_ci.id = oit_ci.order_item_id
      JOIN orders o_ci       ON o_ci.id  = oi_ci.order_id
      WHERE ${OPEN_CI}
        AND oit_ci.id = (
          SELECT MAX(oit_x.id)
          FROM order_item_technicians oit_x
          JOIN order_items oi_x ON oi_x.id = oit_x.order_item_id
          JOIN orders o_x       ON o_x.id  = oi_x.order_id
          WHERE oit_x.technician_id = oit_ci.technician_id
            AND o_x.locked_at IS NULL
            AND o_x.status NOT IN ('cancelled','rejected','closed','delivered')
        )
    ) ci ON ci.technician_id = t.id
    ${where}
    ORDER BY
      CASE t.status
        WHEN 'available' THEN 0
        WHEN 'busy'      THEN 1
        WHEN 'off_shift' THEN 2
        WHEN 'on_leave'  THEN 3
        ELSE 4
      END,
      t.name ASC
  `).all();

  return rows.map(r => ({
    id:                   r.id,
    name:                 r.name,
    role_value:           r.role_value,
    role_display_label_ar: r.role_display_label_ar,
    status:               r.status,
    active_count:         r.active_count,
    urgent_count:         r.urgent_count,
    current_item:         r.ci_item_id != null
      ? { item_id: r.ci_item_id, item_name: r.ci_item_name, order_number: r.ci_order_number }
      : null,
  }));
}

module.exports = {
  STATUS_ENUM,
  STATUS_SORT,
  ITEM_TYPE_SPEC_MAP,
  list,
  getDetail,
  create,
  update,
  softDelete,
  addSpecialization,
  removeSpecialization,
  getWorkload,
  pickerQuery,
  suggestForItem,
  _scoreAndRank,
  getItemTypeSpecMap,
  updateItemTypeSpecMap,
  autoAssign,
  changeStatus,
  getWorkloadSummary,
  // exposed for tests + WF-1c reuse
  countOpenAssignments,
};
