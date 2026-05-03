import { getToken } from './auth';

function authHeaders() {
  const token = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// GET /api/scheduler/status
// Returns { technicians: [{ id, name, status, shift, leave, would_change_to }] }
export async function getSchedulerStatus() {
  const res = await fetch('/api/scheduler/status', { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تحميل حالة الجدولة');
  return data;
}

// POST /api/scheduler/run
// Returns { updated, skipped }
export async function runScheduler() {
  const res = await fetch('/api/scheduler/run', {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'فشل تشغيل الجدولة');
  return data;
}
