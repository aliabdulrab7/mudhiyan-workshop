import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getRoles() {
  const res = await fetch('/api/roles', { headers: authHeaders() });
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
  if (!res.ok) throw new Error(data.error || 'فشل حذف الدور');
  return data;
}
