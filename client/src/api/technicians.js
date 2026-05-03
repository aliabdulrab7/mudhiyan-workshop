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
