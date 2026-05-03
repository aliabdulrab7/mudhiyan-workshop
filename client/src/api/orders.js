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

export async function getOrder(id) {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل الطلب');
  return data.order ?? data;
}

export async function getOrders({ status, search, shop_id, limit } = {}) {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.set('status', status);
  if (search) params.set('search', search);
  if (shop_id) params.set('shop_id', shop_id);
  if (limit) params.set('limit', String(limit));
  const res = await fetch(`${BASE}?${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل الطلبات');
  return res.json();
}

export async function getBranchStats() {
  const res = await fetch(`${BASE}/branch-stats`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل إحصائيات الفروع');
  return res.json();
}

export async function getStats() {
  const res = await fetch('/api/orders/stats', { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل الإحصائيات');
  return res.json();
}

export async function createOrder({ customer_name, phone, items, urgency }) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ customer_name, phone, items, urgency }),
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

// Bulk-scan PATCH: resolve order by barcode + transition in one round-trip.
// Throws a structured Error with { kind, status, code, currentStatus } so the
// caller can map to a specific Arabic row message via bulkScanErrors.js.
export async function patchStatusByBarcode(barcode, body) {
  let res;
  try {
    res = await fetch(`${BASE}/by-barcode/${encodeURIComponent(barcode)}/status`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const e = new Error('network');
    e.kind = 'network';
    throw e;
  }

  if (res.ok) return res.json();

  const data = await res.json().catch(() => ({}));
  const e = new Error(data.error || `HTTP ${res.status}`);
  e.status        = res.status;
  e.code          = data.code;
  e.currentStatus = data.details?.current_status;

  if (res.status === 404)                                     e.kind = 'not_found';
  else if (res.status === 401 || res.status === 403)          e.kind = 'permission';
  else if (res.status === 409 && data.code === 'INVALID_TRANSITION') e.kind = 'invalid_transition';
  else if (res.status === 409)                                e.kind = 'locked';
  else if (res.status >= 500)                                 e.kind = 'server_error';
  else                                                        e.kind = 'other';

  throw e;
}

export async function setOrderUrgent(id, isUrgent) {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ is_urgent: isUrgent ? 1 : 0 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحديث الأولوية');
  }
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

export async function updateItemCost(orderId, itemId, cost) {
  const res = await fetch(`${BASE}/${orderId}/items/${itemId}/cost`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ estimated_cost: cost }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تحديث تكلفة الصنف');
  }
  return res.json();
}

export async function sendForApproval(orderId) {
  const res = await fetch(`${BASE}/${orderId}/send-for-approval`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل إرسال التسعيرة للعميل');
  }
  return res.json();
}

export async function submitDecisions(token, decisions) {
  const res = await fetch(`/api/track/${token}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decisions }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تسجيل القرار');
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

export async function rejectOrder(token) {
  const res = await fetch(`/api/track/${token}/reject`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل الرفض');
  }
  return res.json();
}

export async function confirmPayment(id) {
  const res = await fetch(`${BASE}/${id}/confirm-payment`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'فشل تأكيد الدفع');
  }
  return res.json();
}

export async function getComments(orderId) {
  const res = await fetch(`${BASE}/${orderId}/comments`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل التعليقات');
  return res.json();
}

export async function getOrderHistory(id) {
  const res = await fetch(`${BASE}/${id}/history`, { headers: authHeaders() });
  if (!res.ok) throw new Error('فشل تحميل سجل الحالات');
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

export async function assignTechnicianToOrder(orderId, technicianId) {
  const res = await fetch(`${BASE}/${orderId}/technicians`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ technician_id: technicianId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل تعيين الفني للطلب');
  return data;
}

export async function bulkAssignTechnician(orderIds, technicianId) {
  const res = await fetch(`${BASE}/bulk/technicians`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ order_ids: orderIds, technician_id: technicianId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'فشل التعيين الجماعي للفني');
  return data;
}
