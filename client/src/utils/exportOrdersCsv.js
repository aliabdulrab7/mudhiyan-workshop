// Dashboard CSV export for the orders list.
//
// PII policy: export includes full customer name + phone
// to match on-screen display. See CLAUDE.md § Data handling.

import { STATUS_META } from '../components/StatusPill';

const COLUMNS = [
  { header: 'رقم الطلب',     value: o => o.order_number },
  { header: 'اسم العميل',    value: o => o.customer_name },
  { header: 'الجوال',        value: o => (o.phone ? `+${o.phone}` : '') },
  { header: 'القطعة',        value: o => o.piece_type },
  { header: 'الحالة',        value: o => STATUS_META[o.status]?.label ?? o.status },
  { header: 'مستعجل',        value: o => (o.is_urgent ? 'نعم' : 'لا') },
  { header: 'التكلفة',       value: o => (o.cost == null ? '' : String(o.cost)) },
  { header: 'تاريخ الاستلام', value: o => formatDateRiyadh(o.created_at) },
  { header: 'الفرع',         value: o => o.shop_name || '' },
];

// YYYY-MM-DD HH:mm in Asia/Riyadh — sortable + unambiguous in Excel.
function formatDateRiyadh(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function escapeCell(v) {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportOrdersCsv(orders) {
  const rows = [COLUMNS.map(c => escapeCell(c.header)).join(',')];
  for (const o of orders) {
    rows.push(COLUMNS.map(c => escapeCell(c.value(o))).join(','));
  }
  const csv = '﻿' + rows.join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// YYYY-MM-DD in Asia/Riyadh — shop staff open same-day, UTC would confuse.
export function todayRiyadh() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function downloadOrdersCsv(orders, { status } = {}) {
  const blob = exportOrdersCsv(orders);
  const name = `orders-${status && status !== 'all' ? status : 'all'}-${todayRiyadh()}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}
