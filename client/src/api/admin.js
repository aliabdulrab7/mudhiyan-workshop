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

export async function getUsers() {
  const res = await fetch('/api/admin/users', { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل المستخدمين');
  return res.json();
}

export async function createUser({ username, password }) {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء المستخدم');
  return data;
}

export async function patchUser(id, updates) {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث المستخدم');
  return data;
}

export async function patchUserPassword(id, newPassword) {
  const res = await fetch(`/api/admin/users/${id}/password`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ new_password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تغيير كلمة المرور');
  return data;
}
