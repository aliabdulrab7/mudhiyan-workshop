// StatusPill — replaces StatusBadge.jsx
// Uses color-mix(in oklch) for tinted borders and backgrounds.

export const STATUS_META = {
  new:               { color: '#64748B', label: 'جديد' },
  received:          { color: '#2980B9', label: 'مستلمة' },
  inspection:        { color: '#7C3AED', label: 'قيد الفحص' },
  waiting_approval:  { color: '#D97706', label: 'بانتظار الموافقة' },
  approved:          { color: '#16A34A', label: 'تمت الموافقة' },
  rejected:          { color: '#DC2626', label: 'مرفوضة' },
  in_repair:         { color: '#1A6EA0', label: 'قيد الإصلاح' },
  quality_check:     { color: '#6B21A8', label: 'فحص الجودة' },
  ready_for_return:  { color: '#166534', label: 'جاهزة للإرجاع' },
  returned_to_shop:  { color: '#059669', label: 'وصلت للفرع' },
  delivered:         { color: '#374151', label: 'تم التسليم' },
  closed:            { color: '#64748B', label: 'مغلقة' },
  cancelled:         { color: '#DC2626', label: 'ملغاة' },
  // legacy aliases
  diagnosing:        { color: '#7C3AED', label: 'قيد الفحص' },
  ready_for_pickup:  { color: '#166534', label: 'جاهزة للاستلام' },
  pending_approval:  { color: '#D97706', label: 'بانتظار الموافقة' },
  in_progress:       { color: '#1A6EA0', label: 'قيد العمل' },
  ready:             { color: '#166534', label: 'جاهزة' },
};

const FALLBACK = { color: '#64748B', label: '—' };

export default function StatusPill({ status, size = 'md' }) {
  const meta = STATUS_META[status] ?? FALLBACK;
  const pad = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${pad}`}
      style={{
        color: meta.color,
        borderColor: `color-mix(in oklch, ${meta.color} 30%, var(--border))`,
        background: `color-mix(in oklch, ${meta.color} 9%, var(--bg-raised))`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
