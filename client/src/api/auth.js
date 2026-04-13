export function getToken()  { return localStorage.getItem('token'); }
export function getRole()   { return localStorage.getItem('role'); }
export function getShopId() { return localStorage.getItem('shop_id'); }
export function isLoggedIn() { return !!getToken(); }

export function saveAuth({ token, role, shop_id, username }) {
  localStorage.setItem('token', token);
  localStorage.setItem('role', role);
  localStorage.setItem('username', username || '');
  if (shop_id != null) localStorage.setItem('shop_id', String(shop_id));
}

export function clearAuth() {
  ['token', 'role', 'shop_id', 'username'].forEach(k => localStorage.removeItem(k));
}

export async function login(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'خطأ في تسجيل الدخول');
  }
  const data = await res.json();
  saveAuth(data);
  return data;
}
