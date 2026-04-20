import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getRepairOptions(itemType) {
  const qs = itemType ? `?item_type=${encodeURIComponent(itemType)}` : '';
  const res = await fetch(`/api/repair-options${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل خيارات الإصلاح');
  return data;
}

export async function createRepairOption({ item_type, value, needs }) {
  const res = await fetch('/api/repair-options', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ item_type, value, needs }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة الخيار');
  return data;
}

export async function updateRepairOption(id, patch) {
  const res = await fetch(`/api/repair-options/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث الخيار');
  return data;
}

export async function deleteRepairOption(id) {
  const res = await fetch(`/api/repair-options/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل حذف الخيار');
  return data;
}
