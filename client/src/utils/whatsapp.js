export function buildApprovalWaUrl(phone, customerName, cost, trackingUrl) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `تم تقييم قطعتك وتكلفة الإصلاح: ${cost} ريال.\n` +
    `للموافقة على السعر والمتابعة:\n${trackingUrl}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildReadyWaUrl(phone, customerName, orderNumber) {
  const message =
    `السلام عليكم ${customerName}،\n\n` +
    `نود إعلامكم بأن قطعتكم جاهزة للاستلام.\n` +
    `رقم الطلب: ${orderNumber}\n\n` +
    `شكراً لثقتكم بنا 🏅`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function buildTrackingUrl(customerToken) {
  if (!customerToken) return '';
  return `${window.location.protocol}//${window.location.host}/track/${customerToken}`;
}
