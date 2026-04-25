import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getMySettings() {
  const res = await fetch('/api/auth/me/settings', { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحميل الإعدادات');
  }
  return res.json();
}

export async function patchMySettings(patch) {
  const res = await fetch('/api/auth/me/settings', {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل حفظ الإعدادات');
  }
  return res.json();
}
