import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getRoles({ include_archived = false } = {}) {
  const qs = include_archived ? '?include_archived=true' : '';
  const res = await fetch(`/api/roles${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الأدوار');
  // Server returns { items: [...] }; legacy callers expect a flat array.
  return Array.isArray(data) ? data : (data.items ?? []);
}

export async function createRole({ value, display_label_ar, sort_order }) {
  const res = await fetch('/api/roles', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ value, display_label_ar, sort_order }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة الدور');
  return data;
}

export async function updateRole(id, patch) {
  const res = await fetch(`/api/roles/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث الدور');
  return data;
}

export async function deleteRole(id) {
  const res = await fetch(`/api/roles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'فشل حذف الدور');
    err.status = res.status;
    err.reference_count = data.reference_count ?? 0;
    throw err;
  }
  return data;
}

export async function archiveRole(id) {
  const res = await fetch(`/api/roles/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل أرشفة الدور');
  return data;
}

export async function restoreRole(id) {
  const res = await fetch(`/api/roles/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل استعادة الدور');
  return data;
}

export async function getRoleRefCount(id) {
  const res = await fetch(`/api/roles/${id}/ref-count`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل جلب عدد المراجع');
  return data;
}
