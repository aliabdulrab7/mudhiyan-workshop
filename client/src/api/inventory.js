import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function getInventory({ category, search } = {}) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (search)   params.set('search', search);
  const qs = params.toString() ? `?${params}` : '';

  const res = await fetch(`/api/inventory${qs}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل المخزون');
  return data;
}

export async function createInventoryItem({ name, category, stock_qty, unit, cost_per_unit }) {
  const res = await fetch('/api/inventory', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, category, stock_qty, unit, cost_per_unit }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل إضافة المادة');
  return data;
}

export async function adjustInventoryStock(id, quantity_change) {
  const res = await fetch(`/api/inventory/${id}/stock`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ quantity_change }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تعديل المخزون');
  return data;
}
