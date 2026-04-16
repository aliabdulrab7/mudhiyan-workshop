/**
 * Phone number normalization for Saudi numbers.
 * Standard storage format: 966XXXXXXXXX (12 digits, no +, no spaces, no dashes)
 *
 * Accepted input variants:
 *   +966501234567  → 966501234567
 *   00966501234567 → 966501234567
 *   0501234567     → 966501234567
 *   501234567      → 966501234567
 *   966501234567   → 966501234567 (no change)
 *
 * Throws Error with Arabic message for unrecognizable input.
 */
function normalizePhone(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('رقم الجوال مطلوب');
  }

  // Strip whitespace, dashes, parentheses
  let digits = raw.replace(/[\s\-()]/g, '');

  // Strip leading +
  if (digits.startsWith('+')) digits = digits.slice(1);

  // Strip leading 00966 → 966...
  if (digits.startsWith('00966')) digits = digits.slice(2);

  // 0XXXXXXXXX (10 digits, starts with 0) → 966XXXXXXXXX
  if (/^0[0-9]{9}$/.test(digits)) {
    digits = '966' + digits.slice(1);
  }

  // 5XXXXXXXX (9 digits, starts with 5) → 966XXXXXXXXX
  if (/^5[0-9]{8}$/.test(digits)) {
    digits = '966' + digits;
  }

  // Final validation: must be exactly 966 followed by 9 digits
  if (!/^966[0-9]{9}$/.test(digits)) {
    throw new Error('رقم الجوال غير صالح. الصيغة المقبولة: 966XXXXXXXXX أو 05XXXXXXXX');
  }

  return digits;
}

module.exports = { normalizePhone };
