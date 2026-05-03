import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// Roster fetch — no filters. Used by TechniciansContext.ensureLoaded() to
// populate the assignment dropdowns. Stays a flat list for that consumer
// even after the paginated endpoint lands ({ items, total, ... }).
export async function getTechnicians() {
  const res = await fetch('/api/technicians', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الفنيين');
  return Array.isArray(data) ? data : (data.items ?? []);
}

// Paginated/filterable read — used by the management page only.
// Server contract: { items, total, limit, offset }. With ?with=workload each
// item also carries active_count + urgent_count.
export async function listTechnicians({ search, role_id, status, active, limit = 20, offset = 0, withWorkload = true } = {}) {
  const params = { search, role_id, status, active, limit, offset };
  if (withWorkload) params.with = 'workload';
  const url = `/api/technicians${qs(params)}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الفنيين');
  if (Array.isArray(data)) return { items: data, total: data.length, limit, offset };
  return data;
}

export async function getTechnician(id) {
  const res = await fetch(`/api/technicians/${id}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الفني');
  return data;
}

export async function createTechnician(body) {
  const res = await fetch('/api/technicians', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الفني');
  return data;
}

export async function updateTechnician(id, patch) {
  const res = await fetch(`/api/technicians/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث الفني');
  return data;
}

export async function deleteTechnician(id) {
  const res = await fetch(`/api/technicians/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل حذف الفني');
  return data;
}

// Picker-optimised search endpoint.
// GET /api/technicians/picker?q=&specialization_id=&status=&limit=&offset=
// Default status=available; pass status=all to include busy/off_shift/on_leave.
// Sort: active_count ASC, name ASC (least-busy first). Inactive techs excluded.
export async function getTechniciansPicker({ q, specialization_id, status, limit = 30, offset = 0 } = {}) {
  const params = { q, specialization_id, status, limit, offset, with: 'workload' };
  const res = await fetch(`/api/technicians/picker${qs(params)}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الفنيين');
  return data;
}

// Suggested technicians for a specific order item — scored by spec match + lowest workload.
// GET /api/order-items/:id/suggested-technicians?limit=
// Returns { item_id, item_type, matched_specializations, suggestions: [...] }.
// Gracefully returns empty suggestions on 404/error (advisory, not load-bearing).
export async function getSuggestedTechnicians(itemId, { limit = 5 } = {}) {
  const res = await fetch(`/api/order-items/${itemId}/suggested-technicians${qs({ limit })}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return { suggestions: [] };
  const data = await res.json().catch(() => ({ suggestions: [] }));
  return data;
}

// GET /api/technicians/workload-summary?active_only=true
// Returns { technicians: [{ id, name, role_value, role_display_label_ar, status,
//   active_count, urgent_count, current_item }] }
export async function getWorkloadSummary({ active_only = true } = {}) {
  const params = active_only ? { active_only: 'true' } : {};
  const res = await fetch(`/api/technicians/workload-summary${qs(params)}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل بيانات الأعباء');
  return data;
}

// PATCH /api/technicians/:id/status { status, reason? }
export async function changeStatus(techId, status, reason) {
  const body = { status };
  if (reason) body.reason = reason;
  const res = await fetch(`/api/technicians/${techId}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تغيير الحالة');
  return data;
}

// GET /api/technicians/:id/status-history?limit=20
// Returns { history: [{ from_status, to_status, changed_by_username, reason, changed_at }] }
export async function getStatusHistory(techId, { limit = 20 } = {}) {
  const res = await fetch(`/api/technicians/${techId}/status-history${qs({ limit })}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل سجل الحالة');
  return data;
}

export async function addTechnicianSpecialization(techId, specId) {
  const res = await fetch(`/api/technicians/${techId}/specializations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ specialization_id: specId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل إضافة التخصص');
  return data;
}

export async function removeTechnicianSpecialization(techId, specId) {
  const res = await fetch(`/api/technicians/${techId}/specializations/${specId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل حذف التخصص');
  return data;
}

// GET /api/technicians/:id/shifts → { shifts: [...], leaves: [...] }
export async function getShifts(techId) {
  const res = await fetch(`/api/technicians/${techId}/shifts`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل جدول المناوبات');
  return data;
}

// PUT /api/technicians/:id/shifts/:dayOfWeek → upserted shift
export async function upsertShift(techId, dayOfWeek, startTime, endTime) {
  const res = await fetch(`/api/technicians/${techId}/shifts/${dayOfWeek}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ start_time: startTime, end_time: endTime }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'فشل حفظ المناوبة');
    err.status = res.status;
    throw err;
  }
  return data;
}

// DELETE /api/technicians/:id/shifts/:dayOfWeek → { ok: true }
export async function deleteShift(techId, dayOfWeek) {
  const res = await fetch(`/api/technicians/${techId}/shifts/${dayOfWeek}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل حذف المناوبة');
  return data;
}

// PUT /api/technicians/:id/leaves/:leaveDate { leave_type?, notes? }
// Upserts by date — server returns the upserted row.
export async function addLeave(techId, { leave_date, type, notes }) {
  const res = await fetch(`/api/technicians/${techId}/leaves/${encodeURIComponent(leave_date)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ leave_type: type, notes: notes || null }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة الإجازة');
  return data;
}

// DELETE /api/technicians/:id/leaves/:leaveDate (YYYY-MM-DD) → { ok: true }
export async function deleteLeave(techId, leaveDate) {
  const res = await fetch(`/api/technicians/${techId}/leaves/${leaveDate}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل حذف الإجازة');
  return data;
}

// GET /api/technicians/item-type-spec-map
// Returns { map: [{ item_type, spec_values: string[], updated_at, updated_by_username }] }
export async function getSpecMap() {
  const res = await fetch('/api/technicians/item-type-spec-map', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل خريطة التخصصات');
  return data;
}

// PUT /api/technicians/item-type-spec-map/:itemType
// Body: { spec_values: string[] }
// Returns updated row. Throws with .status on 422.
export async function updateSpecMapEntry(itemType, specValues) {
  const res = await fetch(
    `/api/technicians/item-type-spec-map/${encodeURIComponent(itemType)}`,
    {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ spec_values: specValues }),
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'فشل تحديث خريطة التخصصات');
    err.status = res.status;
    throw err;
  }
  return data;
}
