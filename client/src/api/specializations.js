import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getSpecializations() {
  const res = await fetch('/api/specializations', { headers: authHeaders() });
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
