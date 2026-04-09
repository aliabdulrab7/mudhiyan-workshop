const BASE = '/api/orders';

export async function getConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) return { ip: 'localhost', port: 5173 };
  return res.json();
}

export async function getOrders({ status, search } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) throw new Error('فشل تحميل الطلبات');
  return res.json();
}

export async function getStats() {
  const res = await fetch('/api/orders/stats');
  if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
  return res.json();
}

export async function createOrder(data) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إنشاء الطلب');
  }
  return res.json();
}

export async function getOrderByBarcode(value) {
  const res = await fetch(`${BASE}/barcode/${encodeURIComponent(value)}`);
  if (!res.ok) throw new Error('الطلب غير موجود');
  return res.json();
}

export async function updateOrderStatus(id, status) {
  const res = await fetch(`${BASE}/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('فشل تحديث الحالة');
  return res.json();
}
