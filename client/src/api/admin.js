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

export async function patchBranchName(id, name) {
  const res = await fetch(`/api/admin/branches/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تعديل اسم الفرع');
  return data;
}

export async function patchBranchPassword(id, new_password) {
  const res = await fetch(`/api/admin/branches/${id}/password`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ new_password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تغيير كلمة المرور');
  return data;
}

export async function getBranchSummary(id) {
  const res = await fetch(`/api/admin/branches/${id}/summary`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل ملخص الفرع');
  return data;
}
