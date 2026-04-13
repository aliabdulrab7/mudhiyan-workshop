import { getToken } from './auth';

const BASE = '/api/orders';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) return { ip: 'localhost', port: 5173 };
  return res.json();
}

export async function getOrders({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  const res = await fetch(`${BASE}?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل الطلبات');
  return res.json();
}

export async function getStats() {
  const res = await fetch('/api/orders/stats', { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
  return res.json();
}

export async function createOrder(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إنشاء الطلب');
  }
  return res.json();
}

export async function getOrderByBarcode(value) {
  const res = await fetch(`${BASE}/barcode/${encodeURIComponent(value)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('الطلب غير موجود');
  return res.json();
}

export async function updateOrderStatus(id, status) {
  const res = await fetch(`${BASE}/${id}/status`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('فشل تحديث الحالة');
  return res.json();
}

export async function updateCost(id, cost) {
  const res = await fetch(`${BASE}/${id}/cost`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ cost }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحديث التكلفة');
  }
  return res.json();
}

export async function getTrackOrder(token) {
  const res = await fetch(`/api/track/${token}`);
  if (!res.ok) throw new Error('الطلب غير موجود');
  return res.json();
}

export async function approveOrder(token) {
  const res = await fetch(`/api/track/${token}/approve`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل الموافقة');
  }
  return res.json();
}

export async function getComments(orderId) {
  const res = await fetch(`${BASE}/${orderId}/comments`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل التعليقات');
  return res.json();
}

export async function addComment(orderId, body) {
  const res = await fetch(`${BASE}/${orderId}/comments`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إضافة التعليق');
  }
  return res.json();
}
