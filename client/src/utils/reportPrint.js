const STATUS_LABELS = {
  new:              'جديد',
  received:         'مستلمة في الورشة',
  inspection:       'قيد الفحص',
  waiting_approval: 'بانتظار الموافقة',
  in_repair:        'قيد الإصلاح',
  quality_check:    'فحص الجودة',
  ready_for_return: 'جاهزة للإرجاع',
  returned_to_shop: 'وصلت للفرع',
  delivered:        'مُسلَّمة',
  rejected:         'مرفوضة',
  cancelled:        'ملغاة',
};

const STATUS_ORDER = [
  'new', 'received', 'inspection', 'waiting_approval', 'in_repair',
  'quality_check', 'ready_for_return', 'returned_to_shop', 'delivered',
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateAr(date) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function openReportPrintWindow({ stats, branchStats, generatedAt, username, workshopName }) {
  const when = generatedAt instanceof Date ? generatedAt : new Date();
  const dateStr = formatDateAr(when);
  const filenameDate = when.toISOString().slice(0, 10);
  const title = `${workshopName} — تقرير ${filenameDate}`;

  const statusRows = STATUS_ORDER.map(key => {
    const count = (stats && stats[key]) ?? 0;
    return `<tr><td>${escapeHtml(STATUS_LABELS[key] || key)}</td><td class="num">${count}</td></tr>`;
  }).join('');

  const branchRows = (branchStats || []).map(b => {
    const active = (b.received ?? 0) + (b.pending_approval ?? 0) + (b.in_progress ?? 0) + (b.ready ?? 0);
    return `<tr>
      <td>${escapeHtml(b.shop_name)}</td>
      <td class="num">${b.received ?? 0}</td>
      <td class="num">${b.pending_approval ?? 0}</td>
      <td class="num">${b.in_progress ?? 0}</td>
      <td class="num">${b.ready ?? 0}</td>
      <td class="num total">${active}</td>
    </tr>`;
  }).join('');

  const branchSection = (branchStats && branchStats.length > 0)
    ? `<h2>توزيع الفروع</h2>
       <table class="report-table">
         <thead>
           <tr>
             <th>الفرع</th>
             <th class="num">مستلمة</th>
             <th class="num">بانتظار الموافقة</th>
             <th class="num">قيد الإصلاح</th>
             <th class="num">جاهزة</th>
             <th class="num">الإجمالي النشط</th>
           </tr>
         </thead>
         <tbody>${branchRows}</tbody>
       </table>`
    : `<h2>توزيع الفروع</h2><p class="muted">لا توجد بيانات فروع</p>`;

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  html, body { margin: 0; padding: 0; background: #fff; color: #111; }
  body {
    font-family: 'Almarai', 'Tahoma', system-ui, sans-serif;
    direction: rtl; text-align: right;
    padding: 24px 28px;
    font-size: 12pt;
  }
  header {
    border-bottom: 2px solid #111;
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  header .workshop { font-size: 18pt; font-weight: 800; letter-spacing: -0.01em; }
  header .meta { font-size: 10pt; color: #555; margin-top: 4px; display: flex; gap: 18px; flex-wrap: wrap; }
  h2 { font-size: 13pt; margin: 22px 0 8px; }
  .report-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11pt;
    margin-bottom: 6px;
  }
  .report-table th, .report-table td {
    border: 1px solid #bbb;
    padding: 6px 10px;
    text-align: right;
  }
  .report-table thead th {
    background: #f3f3f3;
    font-weight: 700;
  }
  .num { text-align: center; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', Menlo, monospace; }
  .total { font-weight: 700; }
  .muted { color: #777; font-size: 11pt; }
  footer {
    margin-top: 28px; padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 9pt; color: #777;
    display: flex; justify-content: space-between;
  }
  @media screen {
    body { max-width: 820px; margin: 0 auto; }
    .hint {
      background: #fff7e0; border: 1px solid #e6c766;
      padding: 8px 12px; border-radius: 4px;
      font-size: 10pt; margin-bottom: 14px;
    }
  }
  @media print { .hint { display: none; } }
</style>
</head>
<body>
  <div class="hint">إذا لم يبدأ مربع الطباعة تلقائياً، استخدم Ctrl/Cmd + P. لحفظ PDF اختر "Save as PDF" في وجهة الطباعة.</div>

  <header>
    <div class="workshop">${escapeHtml(workshopName)}</div>
    <div class="meta">
      <span>تقرير حالة الطلبات</span>
      <span>مُنشأ في: ${escapeHtml(dateStr)}</span>
      ${username ? `<span>بواسطة: ${escapeHtml(username)}</span>` : ''}
    </div>
  </header>

  <h2>ملخص الطلبات</h2>
  <table class="report-table">
    <thead>
      <tr><th>الحالة</th><th class="num">العدد</th></tr>
    </thead>
    <tbody>${statusRows}</tbody>
  </table>

  ${branchSection}

  <footer>
    <span>${escapeHtml(workshopName)}</span>
    <span>${escapeHtml(filenameDate)}</span>
  </footer>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 300);
    });
    window.onafterprint = function () { window.close(); };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=1100');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
