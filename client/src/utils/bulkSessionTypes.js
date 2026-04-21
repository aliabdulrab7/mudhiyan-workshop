// Bulk-scan session types — the three hard-coded workflows /scan's bulk mode supports.
// Each type is locked to one target state + a whitelist of accepted source states + a role.
// The server enforces the transition in OrderService; this object is the UI's source of truth
// for labels, role gating, and the session_type slug threaded into order_status_history.notes.

export const BULK_SESSION_TYPES = [
  {
    id:            'intake_from_branches',
    label:         'استلام من الفرع',
    roleHint:      'ورشة فقط',
    role:          'workshop',
    sourceStates:  ['new'],
    targetState:   'received',
    successText:   'استلام ناجح',
  },
  {
    id:            'prepare_for_return',
    label:         'تجهيز للإرجاع',
    roleHint:      'ورشة فقط',
    role:          'workshop',
    sourceStates:  ['quality_check', 'rejected'],
    targetState:   'ready_for_return',
    successText:   'تم التجهيز',
  },
  {
    id:            'pickup_from_workshop',
    label:         'استلام من الورشة',
    roleHint:      'فرع فقط',
    role:          'shop_employee',
    sourceStates:  ['ready_for_return'],
    targetState:   'returned_to_shop',
    successText:   'تم التحويل للفرع',
  },
];

export function getAllowedSessionTypes(role) {
  return BULK_SESSION_TYPES.filter((t) => t.role === role);
}

export function getSessionTypeById(id) {
  return BULK_SESSION_TYPES.find((t) => t.id === id) || null;
}
