import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getSpecializations({ include_archived = false } = {}) {
  const qs = include_archived ? '?include_archived=true' : '';
  const res = await fetch(`/api/specializations${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل التخصصات');
  return Array.isArray(data) ? data : (data.items ?? []);
}

export async function createSpecialization({ value, display_label_ar, sort_order }) {
  const res = await fetch('/api/specializations', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ value, display_label_ar, sort_order }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة التخصص');
  return data;
}

export async function updateSpecialization(id, patch) {
  const res = await fetch(`/api/specializations/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث التخصص');
  return data;
}

export async function deleteSpecialization(id) {
  const res = await fetch(`/api/specializations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل حذف التخصص');
  return data;
}

export async function archiveSpecialization(id) {
  const res = await fetch(`/api/specializations/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل أرشفة التخصص');
  return data;
}

export async function restoreSpecialization(id) {
  const res = await fetch(`/api/specializations/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل استعادة التخصص');
  return data;
}

export async function getSpecRefCount(id) {
  const res = await fetch(`/api/specializations/${id}/ref-count`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل جلب عدد المراجع');
  return data;
}
