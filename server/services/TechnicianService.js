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
           t.active, t.created_at,
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
    throw new ValidationError(`الحالة غير صالحة: ${status}`);
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

// Item type → specialization value keys. Hardcoded for WF-2; configurable in WF-4.
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

  const matchedSpecValues = ITEM_TYPE_SPEC_MAP[item.item_type] || [];

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

module.exports = {
  STATUS_ENUM,
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
  // exposed for tests + WF-1c reuse
  countOpenAssignments,
};
