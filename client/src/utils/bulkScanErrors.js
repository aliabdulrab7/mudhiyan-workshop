// Error taxonomy for bulk-scan rows. Maps a classified network/HTTP outcome
// into the Arabic one-liner shown on a red running-list row. Mirrors
// docs/BULK-SCAN-SPEC.md § Error taxonomy.

const STATUS_LABEL_AR = {
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

// Per-session-type wrong-source-state copy, keyed by session type id.
const WRONG_SOURCE_MSG = {
  intake_from_branches: (st) => `الطلب في حالة '${st}' — لا يمكن استلامه من الفرع`,
  prepare_for_return:   (st) => `الطلب في حالة '${st}' — لم يكتمل الفحص`,
  pickup_from_workshop: (st) => `الطلب في حالة '${st}' — غير جاهز للاستلام`,
};

export function mapErrorToArabic(err, sessionType, role) {
  const kind = err?.kind;

  if (kind === 'network')       return 'خطأ في الاتصال — أعد المسح';
  if (kind === 'server_error')  return 'خطأ مؤقت — أعد المسح';

  if (kind === 'not_found') {
    // A shop_employee hitting by-barcode for an order outside their shop gets 404
    // indistinguishable from "does not exist" — per spec we prefer the
    // cross-shop message for shop_employee, since that's the likely cause.
    if (role === 'shop_employee') return 'هذا الطلب لفرع آخر — لا يمكنك استلامه';
    return 'لم يُعثر على طلب بهذا الرقم';
  }

  if (kind === 'permission') return 'لا تملك صلاحية لهذا الإجراء';

  if (kind === 'invalid_transition') {
    const currentRaw = err?.currentStatus || 'unknown';
    const currentAr  = STATUS_LABEL_AR[currentRaw] || currentRaw;
    const tmpl = WRONG_SOURCE_MSG[sessionType?.id];
    if (tmpl) return tmpl(currentAr);
    return `لا يمكن الانتقال من '${currentAr}'`;
  }

  if (kind === 'locked') return 'الطلب مغلق بعد التسليم';

  if (kind === 'malformed') return 'الرمز غير صالح — تجاوز';

  return err?.message || 'خطأ غير معروف';
}

export const DUPLICATE_MSG = 'مكرر — تم تجاهله';

export function arabicStatusLabel(raw) {
  return STATUS_LABEL_AR[raw] || raw;
}
