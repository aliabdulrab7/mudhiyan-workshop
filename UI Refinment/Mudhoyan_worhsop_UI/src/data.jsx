// ── Mock data for the workshop prototype ──
// Bilingual strings + rich order records so every screen feels real.

const I18N = {
  en: {
    brand: 'Workbench',
    brandSub: 'Jewelry workshop ops',
    search: 'Search orders, customers, IDs…',
    sidebar: {
      section1: 'Workspace',
      section2: 'Admin',
      dashboard: 'Dashboard',
      orders: 'All orders',
      inbox: 'My queue',
      newOrder: 'New intake',
      scan: 'Scan',
      label: 'Label print',
      track: 'Customer track',
      inventory: 'Inventory',
      reports: 'Reports',
      branches: 'Branches',
    },
    crumbs: {
      dashboard: 'Dashboard',
      orders: 'Orders',
      newOrder: 'Orders · New intake',
      scan: 'Scan',
      label: 'Label print',
      track: 'Customer tracking',
    },
    stats: {
      received: 'Received',
      inspection: 'Inspecting',
      waiting: 'Awaiting approval',
      repair: 'In repair',
      quality: 'Quality check',
      ready: 'Ready to return',
      delivered: 'At branch',
    },
    status: {
      received:         'Received',
      inspection:       'Inspecting',
      waiting_approval: 'Awaiting approval',
      in_repair:        'In repair',
      quality_check:    'Quality check',
      ready_for_return: 'Ready',
      returned_to_shop: 'At branch',
      delivered:        'Delivered',
      closed:           'Closed',
    },
    table: {
      id: 'Order',
      customer: 'Customer',
      piece: 'Piece',
      branch: 'Branch',
      technician: 'Technician',
      status: 'Status',
      eta: 'ETA',
      updated: 'Updated',
      value: 'Value',
      unassigned: 'Unassigned',
    },
    actions: {
      newOrder: 'New intake',
      assign: 'Assign',
      changeStatus: 'Change status',
      printLabel: 'Print label',
      notify: 'Notify customer',
      export: 'Export',
      filter: 'Filter',
      sort: 'Sort',
      group: 'Group',
    },
    detail: {
      customer: 'Customer',
      piece: 'Piece',
      branch: 'Branch',
      technician: 'Technician',
      intakeAt: 'Intake',
      quotedAt: 'Quoted',
      eta: 'ETA',
      value: 'Declared value',
      notes: 'Intake notes',
      workshopNotes: 'Workshop notes',
      history: 'Activity',
      services: 'Services',
      costs: 'Costs',
    },
    bulk: { selected: 'selected', clear: 'Clear' },
    paletteHint: 'Search or run a command',
    paletteGroups: { jump: 'Jump to', actions: 'Actions', orders: 'Recent orders' },
  },
  ar: {
    brand: 'ورشة',
    brandSub: 'إدارة ورشة المجوهرات',
    search: 'بحث عن طلبات، عملاء، أرقام…',
    sidebar: {
      section1: 'مساحة العمل',
      section2: 'الإدارة',
      dashboard: 'اللوحة',
      orders: 'كل الطلبات',
      inbox: 'طابوري',
      newOrder: 'استلام جديد',
      scan: 'مسح',
      label: 'طباعة ملصق',
      track: 'تتبع العميل',
      inventory: 'المخزون',
      reports: 'التقارير',
      branches: 'الفروع',
    },
    crumbs: {
      dashboard: 'اللوحة',
      orders: 'الطلبات',
      newOrder: 'الطلبات · استلام جديد',
      scan: 'مسح',
      label: 'طباعة ملصق',
      track: 'تتبع الطلب',
    },
    stats: {
      received: 'مستلمة',
      inspection: 'قيد الفحص',
      waiting: 'بانتظار الموافقة',
      repair: 'قيد الإصلاح',
      quality: 'فحص الجودة',
      ready: 'جاهزة للإرجاع',
      delivered: 'وصلت للفرع',
    },
    status: {
      received:         'مستلمة',
      inspection:       'قيد الفحص',
      waiting_approval: 'بانتظار الموافقة',
      in_repair:        'قيد الإصلاح',
      quality_check:    'فحص الجودة',
      ready_for_return: 'جاهزة',
      returned_to_shop: 'بالفرع',
      delivered:        'تم التسليم',
      closed:           'مغلقة',
    },
    table: {
      id: 'الطلب',
      customer: 'العميل',
      piece: 'القطعة',
      branch: 'الفرع',
      technician: 'الفني',
      status: 'الحالة',
      eta: 'الموعد',
      updated: 'التحديث',
      value: 'القيمة',
      unassigned: 'غير مُعيّن',
    },
    actions: {
      newOrder: 'استلام جديد',
      assign: 'تعيين',
      changeStatus: 'تغيير الحالة',
      printLabel: 'طباعة ملصق',
      notify: 'إشعار العميل',
      export: 'تصدير',
      filter: 'فلتر',
      sort: 'ترتيب',
      group: 'تجميع',
    },
    detail: {
      customer: 'العميل',
      piece: 'القطعة',
      branch: 'الفرع',
      technician: 'الفني',
      intakeAt: 'الاستلام',
      quotedAt: 'التسعير',
      eta: 'الموعد',
      value: 'القيمة المُقدَّرة',
      notes: 'ملاحظات الاستلام',
      workshopNotes: 'ملاحظات الورشة',
      history: 'السجل',
      services: 'الخدمات',
      costs: 'التكاليف',
    },
    bulk: { selected: 'مختارة', clear: 'إلغاء' },
    paletteHint: 'ابحث أو نفّذ أمرًا',
    paletteGroups: { jump: 'انتقل إلى', actions: 'إجراءات', orders: 'طلبات حديثة' },
  }
};

const STATUS_ORDER = [
  'received', 'inspection', 'waiting_approval',
  'in_repair', 'quality_check', 'ready_for_return',
  'returned_to_shop', 'delivered', 'closed'
];

const STATUS_META = {
  received:         { color: 'var(--status-received)',   key: 'received' },
  inspection:       { color: 'var(--status-inspection)', key: 'inspection' },
  waiting_approval: { color: 'var(--status-waiting)',    key: 'waiting_approval' },
  in_repair:        { color: 'var(--status-repair)',     key: 'in_repair' },
  quality_check:    { color: 'var(--status-quality)',    key: 'quality_check' },
  ready_for_return: { color: 'var(--status-ready)',      key: 'ready_for_return' },
  returned_to_shop: { color: 'var(--status-delivered)',  key: 'returned_to_shop' },
  delivered:        { color: 'var(--status-delivered)',  key: 'delivered' },
  closed:           { color: 'var(--status-closed)',     key: 'closed' },
};

const BRANCHES = [
  { id: 'riyadh-olaya',   en: 'Riyadh · Olaya',   ar: 'الرياض · العليا' },
  { id: 'riyadh-nakheel', en: 'Riyadh · Nakheel', ar: 'الرياض · النخيل' },
  { id: 'jeddah-tahlia',  en: 'Jeddah · Tahlia',  ar: 'جدة · التحلية' },
  { id: 'dammam-corniche',en: 'Dammam · Corniche',ar: 'الدمام · الكورنيش' },
  { id: 'madinah-quba',   en: 'Madinah · Quba',   ar: 'المدينة · قباء' },
];

const TECHNICIANS = [
  { id: 't1', en: 'Khalid A.',   ar: 'خالد ع.',     skill: 'Stone setting' },
  { id: 't2', en: 'Rania M.',    ar: 'رانيا م.',    skill: 'Polishing' },
  { id: 't3', en: 'Hassan B.',   ar: 'حسن ب.',      skill: 'Soldering' },
  { id: 't4', en: 'Noura S.',    ar: 'نورة س.',     skill: 'Engraving' },
  { id: 't5', en: 'Majed F.',    ar: 'ماجد ف.',     skill: 'Repair' },
];

const PIECES = [
  { en: 'Ring',     ar: 'خاتم' },
  { en: 'Bracelet', ar: 'سوار' },
  { en: 'Necklace', ar: 'عقد' },
  { en: 'Earrings', ar: 'حلق' },
  { en: 'Watch',    ar: 'ساعة' },
  { en: 'Pendant',  ar: 'قلادة' },
  { en: 'Band',     ar: 'دبلة' },
];

const CUSTOMERS = [
  { en: 'Mohammed Al-Otaibi', ar: 'محمد العتيبي',   phone: '966501234567' },
  { en: 'Sara Al-Dosari',     ar: 'سارة الدوسري',   phone: '966553214590' },
  { en: 'Yousef Al-Harbi',    ar: 'يوسف الحربي',    phone: '966547890102' },
  { en: 'Layla Al-Qahtani',   ar: 'ليلى القحطاني',  phone: '966566001122' },
  { en: 'Fahad Al-Rashid',    ar: 'فهد الرشيد',     phone: '966592334455' },
  { en: 'Hessa Al-Mutairi',   ar: 'حصة المطيري',    phone: '966530112233' },
  { en: 'Abdulrahman N.',     ar: 'عبدالرحمن ن.',   phone: '966558998877' },
  { en: 'Reem Al-Farsi',      ar: 'ريم الفارسي',    phone: '966501122334' },
  { en: 'Omar Al-Shehri',     ar: 'عمر الشهري',     phone: '966544557788' },
  { en: 'Ghada Al-Sulaiman',  ar: 'غادة السليمان',  phone: '966522887766' },
  { en: 'Turki Al-Ghamdi',    ar: 'تركي الغامدي',   phone: '966515678901' },
  { en: 'Maram Al-Zahrani',   ar: 'مرام الزهراني',  phone: '966539876543' },
];

const ISSUES = [
  { en: 'Broken clasp',         ar: 'كسر في الإبزيم' },
  { en: 'Missing stone',        ar: 'فقدان حجر' },
  { en: 'Polishing + rhodium',  ar: 'تلميع وروديوم' },
  { en: 'Resizing (−1)',        ar: 'تصغير مقاس (−1)' },
  { en: 'Resizing (+2)',        ar: 'تكبير مقاس (+2)' },
  { en: 'Deep scratch buffing', ar: 'إزالة خدش عميق' },
  { en: 'Chain weld',           ar: 'لحام السلسلة' },
  { en: 'Prong retipping',      ar: 'إعادة شوك الحجر' },
];

// Deterministic pseudo-random
function rnd(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}

function pad(n, w = 4) { return String(n).padStart(w, '0'); }

function makeOrders() {
  const r = rnd(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const now = new Date('2026-04-18T10:40:00Z').getTime();

  const statuses = [
    'received','received','received',
    'inspection','inspection',
    'waiting_approval','waiting_approval',
    'in_repair','in_repair','in_repair','in_repair',
    'quality_check','quality_check',
    'ready_for_return','ready_for_return','ready_for_return',
    'returned_to_shop','returned_to_shop',
    'delivered','delivered','delivered','delivered',
    'closed'
  ];

  return statuses.map((status, i) => {
    const cust = pick(CUSTOMERS);
    const piece = pick(PIECES);
    const branch = pick(BRANCHES);
    const tech = r() < 0.78 ? pick(TECHNICIANS) : null;
    const issue = pick(ISSUES);
    const hoursAgo = Math.floor(r() * 240) + 1;
    const etaDays = Math.floor(r() * 7) + 1;
    const value = Math.floor((r() * 4800) + 400);
    const orderNum = 'WB-' + pad(2048 + i);
    return {
      id: 'ord-' + i,
      order_number: orderNum,
      status,
      customer: cust,
      piece,
      branch,
      technician: tech,
      issue,
      quantity: (r() < 0.8) ? 1 : Math.floor(r() * 3) + 2,
      createdAt: new Date(now - hoursAgo * 3600 * 1000),
      etaAt: new Date(now + etaDays * 24 * 3600 * 1000),
      value,
      priority: r() < 0.12 ? 'rush' : (r() < 0.25 ? 'low' : 'normal'),
      notes: `${issue.en}. Customer requested original finish.`,
      notes_ar: `${issue.ar}. يرغب العميل بالحفاظ على اللمسة الأصلية.`,
      workshop_notes: [
        { en: 'Soldering required at 2 points', ar: 'لحام مطلوب في نقطتين' },
        { en: 'Stone setting prongs worn', ar: 'شوك الحجر متآكلة' },
        { en: 'Polish after structural work', ar: 'تلميع بعد الإصلاح الإنشائي' },
      ][Math.floor(r() * 3)],
      services: [
        { name_en: 'Rhodium plating', name_ar: 'طلاء روديوم', price: 180 },
        { name_en: 'Prong retipping', name_ar: 'شوك الأحجار', price: 220 },
        { name_en: 'Polish',          name_ar: 'تلميع',        price: 95 },
      ].slice(0, Math.floor(r() * 3) + 1),
      history: buildHistory(status, now, hoursAgo),
    };
  });
}

function buildHistory(currentStatus, now, hoursAgo) {
  const chain = STATUS_ORDER.slice(0, STATUS_ORDER.indexOf(currentStatus) + 1);
  return chain.map((s, idx) => ({
    status: s,
    at: new Date(now - (hoursAgo - idx * (hoursAgo / (chain.length + 1))) * 3600 * 1000),
    who: ['Intake · Nakheel', 'Workshop · Hassan B.', 'Customer', 'Workshop · Khalid A.', 'QC', 'Logistics'][idx % 6],
  }));
}

const ORDERS = makeOrders();

// Count by status
function statusCounts(orders) {
  const c = {};
  STATUS_ORDER.forEach(s => c[s] = 0);
  orders.forEach(o => { c[o.status] = (c[o.status] || 0) + 1; });
  return c;
}

// Format relative time
function relTime(d, dir = 'ltr') {
  const now = new Date('2026-04-18T10:40:00Z').getTime();
  const diff = Math.round((d.getTime() - now) / 60000);
  const abs = Math.abs(diff);
  const past = diff < 0;
  let out;
  if (abs < 1) out = dir === 'rtl' ? 'الآن' : 'just now';
  else if (abs < 60) out = dir === 'rtl' ? `${abs} د` : `${abs}m`;
  else if (abs < 1440) out = dir === 'rtl' ? `${Math.round(abs/60)} س` : `${Math.round(abs/60)}h`;
  else out = dir === 'rtl' ? `${Math.round(abs/1440)} ي` : `${Math.round(abs/1440)}d`;
  if (dir === 'rtl') return past ? `قبل ${out}` : `بعد ${out}`;
  return past ? `${out} ago` : `in ${out}`;
}

function formatDate(d, dir = 'ltr') {
  const opts = { day: 'numeric', month: 'short' };
  return d.toLocaleDateString(dir === 'rtl' ? 'ar' : 'en', opts);
}

function formatMoney(v, dir = 'ltr') {
  const n = v.toLocaleString(dir === 'rtl' ? 'ar-EG' : 'en-US');
  return dir === 'rtl' ? `${n} ر.س` : `SAR ${n}`;
}

Object.assign(window, {
  I18N, STATUS_ORDER, STATUS_META, BRANCHES, TECHNICIANS, PIECES, CUSTOMERS, ISSUES,
  ORDERS, statusCounts, relTime, formatDate, formatMoney, pad
});
