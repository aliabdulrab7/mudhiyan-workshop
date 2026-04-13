import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getBranches() {
  const res = await fetch('/api/admin/branches', { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل الفروع');
  return res.json();
}

export async function createBranch({ name, username, password }) {
  const res = await fetch('/api/admin/branches', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الفرع');
  return data;
}

export async function deleteBranch(id) {
  const res = await fetch(`/api/admin/branches/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('فشل حذف الفرع');
}
