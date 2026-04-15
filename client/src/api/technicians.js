import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getTechnicians() {
  const res = await fetch('/api/technicians', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الفنيين');
  return data;
}

export async function createTechnician({ user_id, specialization } = {}) {
  const res = await fetch('/api/technicians', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ user_id, specialization }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الفني');
  return data;
}
