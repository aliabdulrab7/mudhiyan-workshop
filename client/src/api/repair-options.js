import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getRepairOptions(itemType, { include_archived = false } = {}) {
  const params = new URLSearchParams();
  if (itemType) params.set('item_type', itemType);
  if (include_archived) params.set('include_archived', 'true');
  const qs = params.toString() ? `?${params}` : '';
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

export async function archiveRepairOption(id) {
  const res = await fetch(`/api/repair-options/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل أرشفة الخيار');
  return data;
}

export async function restoreRepairOption(id) {
  const res = await fetch(`/api/repair-options/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل استعادة الخيار');
  return data;
}
