import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getServices() {
  const res = await fetch('/api/services', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الخدمات');
  return data;
}

export async function createService({ name, description, default_price }) {
  const res = await fetch('/api/services', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, description, default_price }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إنشاء الخدمة');
  return data;
}

export async function updateService(id, { name, description, default_price }) {
  const res = await fetch(`/api/services/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ name, description, default_price }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث الخدمة');
  return data;
}
