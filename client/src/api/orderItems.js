import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function submitDiagnosis(itemId, { repair_description, estimated_cost }) {
  const res = await fetch(`/api/order-items/${itemId}/diagnosis`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ repair_description, estimated_cost }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إرسال التشخيص');
  return data;
}

export async function updateOrderItem(itemId, fields) {
  const res = await fetch(`/api/order-items/${itemId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(fields),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحديث الصنف');
  return data;
}

export async function addItemPhoto(itemId, { photo_url, photo_type }) {
  const res = await fetch(`/api/order-items/${itemId}/photos`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ photo_url, photo_type }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة الصورة');
  return data;
}

export async function getItemPhotos(itemId) {
  const res = await fetch(`/api/order-items/${itemId}/photos`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل صور الصنف');
  return data;
}

export async function assignServiceToItem(itemId, { service_id, price, notes }) {
  const res = await fetch(`/api/order-items/${itemId}/services`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ service_id, price, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة الخدمة للصنف');
  return data;
}

export async function recordPartUsed(itemId, { inventory_item_id, quantity }) {
  const res = await fetch(`/api/order-items/${itemId}/parts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ inventory_item_id, quantity }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تسجيل استخدام المادة');
  return data;
}

export async function assignTechnicianToItem(itemId, { technician_id }) {
  const res = await fetch(`/api/order-items/${itemId}/technicians`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ technician_id }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تعيين الفني للصنف');
  return data;
}

export async function unassignTechnicianFromItem(itemId) {
  const res = await fetch(`/api/order-items/${itemId}/technicians`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إلغاء تعيين الفني');
  return data;
}
