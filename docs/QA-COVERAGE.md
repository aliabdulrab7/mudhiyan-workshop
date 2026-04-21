# QA Coverage Sweep

Generated: 2026-04-21T03:41:48.192Z
Harness: Playwright Chromium headless, ignoreHTTPSErrors
Strategy: click every unique interactive element once (deduped by label+tag+href). Classify by observable effect: navigation, XHR, DOM delta, console/page error.

## Legend
- **works** — produced navigation, XHR, or DOM change
- **dead** — no observable effect
- **errors** — console.error, pageerror, or 5xx XHR
- **unclear** — skipped (destructive, form-submit needing context, disabled, or click timed out)

## Summary
| Status | Count |
|---|---|
| works | 210 |
| dead | 21 |
| errors | 0 |
| unclear | 192 |
| **Total** | **423** |

## Notable dead elements (excluding sidebar self-nav)

| Element | Seen on | Count |
|---|---|---|
| الطلبات | shop_employee /branches; shop_employee /reports; shop_employee /technicians; +3 more | 6 |
| تسجيل الدخول | public /login | 1 |
| ✗ أرفض | public /track/8c25ab84-3673-44d5-9076-ef4dec2cf9b9 | 1 |
| تصدير | workshop /reports | 1 |

_Caveat: the "dead" classifier requires >20B DOM delta or a fetch/navigation. Buttons whose only effect is a small state flag (e.g., toggling `aria-pressed`) may register as dead — false negatives are possible here. Step 2 deep-checks will verify these case-by-case._

## public :: /login

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| تسجيل الدخول | button | (click) | no observable effect | dead |

## public :: /track/8c25ab84-3673-44d5-9076-ef4dec2cf9b9

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| ✓ أوافق | button | (click) | DOM Δ 36B | works |
| ✗ أرفض | button | (click) | no observable effect | dead |
| اختر لكل صنف (1 متبقية) | button | (click) | disabled | unclear |

## workshop :: /

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 3 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 20 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم 3 | button | (click) | element vanished before click | unclear |
| فلتر | button | (click) | DOM Δ 1273B | works |
| ترتيب | button | (click) | DOM Δ 1948B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |
| بدء الفحص | button | (click) | element vanished before click | unclear |
| استلام | button | (click) | element vanished before click | unclear |

## workshop :: /new

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | no observable effect | dead |
| <button> | button | (click) | element vanished before click | unclear |
| إلغاء esc | button | (click) | element vanished before click | unclear |
| حفظ الطلب ⌘S | button | (click) | form-submit — skipped (needs filled form) | unclear |
| عادي | button | (click) | element vanished before click | unclear |
| مستعجل | button | (click) | element vanished before click | unclear |
| إضافة إصلاح | button | (click) | element vanished before click | unclear |
| إضافة صنف | button | (click) | element vanished before click | unclear |

## workshop :: /scan

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | no observable effect | dead |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| تبديل إلى الوضع الدفعي | button | (click) | DOM Δ 202B | works |
| مسح بالكاميرا | button | (click) | element vanished before click | unclear |
| مسح آخر | button | (click) | element vanished before click | unclear |
| بحث | button | (click) | disabled | unclear |

## workshop :: /orders

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| الكل | button | (click) | XHR GET /api/orders → 200 | works |
| مستلمة | button | (click) | navigated → /orders | works |
| بانتظار الموافقة | button | (click) | navigated → /orders | works |
| قيد العمل | button | (click) | navigated → /orders | works |
| جاهزة | button | (click) | navigated → /orders | works |
| تم التسليم | button | (click) | navigated → /orders | works |

## workshop :: /branches

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | no observable effect | dead |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| فرع جديد | button | (click) | DOM Δ 758B | works |
| حذف | button | (click) | destructive — not clicked | unclear |

## workshop :: /reports

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | no observable effect | dead |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| تصدير | button | (click) | no observable effect | dead |

## workshop :: /technicians

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | no observable effect | dead |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| إضافة فني | button | (click) | DOM Δ 288B | works |

## workshop :: /inventory

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | no observable effect | dead |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| إضافة مادة | button | (click) | DOM Δ 1046B | works |

## workshop :: /services

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | no observable effect | dead |
| خيارات الإصلاح | a href=/repair-options | (click) | navigated → /repair-options | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| إضافة خدمة | button | (click) | DOM Δ 595B | works |

## workshop :: /repair-options

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| الفروع | a href=/branches | (click) | navigated → /branches | works |
| التقارير | a href=/reports | (click) | navigated → /reports | works |
| الفنيون | a href=/technicians | (click) | navigated → /technicians | works |
| المخزون | a href=/inventory | (click) | navigated → /inventory | works |
| الخدمات | a href=/services | (click) | navigated → /services | works |
| خيارات الإصلاح | a href=/repair-options | (click) | no observable effect | dead |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| <button> | button | (click) | element vanished before click | unclear |
| خاتم 7 | button | (click) | element vanished before click | unclear |
| حلق 6 | button | (click) | element vanished before click | unclear |
| سوار 9 | button | (click) | element vanished before click | unclear |
| عقد 8 | button | (click) | element vanished before click | unclear |
| دبلة 6 | button | (click) | element vanished before click | unclear |
| ساعة 4 | button | (click) | element vanished before click | unclear |
| أخرى 4 | button | (click) | element vanished before click | unclear |
| إضافة | button | (click) | DOM Δ 236B | works |
| إيقاف | button | (click) | element vanished before click | unclear |
| تعديل | button | (click) | DOM Δ 545B | works |
| حذف | button | (click) | destructive — not clicked | unclear |

## shop_employee :: /

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /new

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| صيانة جديدة | a href=/new | (click) | no observable effect | dead |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| إلغاء esc | button | (click) | element vanished before click | unclear |
| حفظ الطلب ⌘S | button | (click) | form-submit — skipped (needs filled form) | unclear |
| عادي | button | (click) | element vanished before click | unclear |
| مستعجل | button | (click) | element vanished before click | unclear |
| إضافة إصلاح | button | (click) | element vanished before click | unclear |
| إضافة صنف | button | (click) | element vanished before click | unclear |

## shop_employee :: /scan

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | no observable effect | dead |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تبديل إلى الوضع الدفعي | button | (click) | DOM Δ 818B | works |
| مسح بالكاميرا | button | (click) | element vanished before click | unclear |
| مسح آخر | button | (click) | element vanished before click | unclear |
| بحث | button | (click) | disabled | unclear |

## shop_employee :: /orders

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | navigated → / | works |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| الكل | button | (click) | XHR GET /api/orders → 200 | works |
| مستلمة | button | (click) | navigated → /orders | works |
| بانتظار الموافقة | button | (click) | navigated → /orders | works |
| قيد العمل | button | (click) | navigated → /orders | works |
| جاهزة | button | (click) | navigated → /orders | works |
| تم التسليم | button | (click) | navigated → /orders | works |

## shop_employee :: /branches

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /reports

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /technicians

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders/stats → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /inventory

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /services

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders/stats → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |

## shop_employee :: /repair-options

| Element | Kind | Action on Click | Result | Status |
|---|---|---|---|---|
| الطلبات | a href=/ | (click) | no observable effect | dead |
| صيانة جديدة | a href=/new | (click) | navigated → /new | works |
| مسح | a href=/scan | (click) | navigated → /scan | works |
| بحث سريع… ⌘K | button | (click) | element vanished before click | unclear |
| تسجيل الخروج | button | (click) | destructive — not clicked | unclear |
| بحث أو تنقل… ⌘ K | button | (click) | element vanished before click | unclear |
| <button> | button | (click) | element vanished before click | unclear |
| تحديث | button | (click) | XHR GET /api/orders/stats → 200 | works |
| تصدير | button | (click) | XHR GET /api/orders → 200 | works |
| جديد 2 | button | (click) | element vanished before click | unclear |
| مستلمة 1 | button | (click) | element vanished before click | unclear |
| قيد الفحص 0 | button | (click) | element vanished before click | unclear |
| بانتظار الموافقة 4 | button | (click) | element vanished before click | unclear |
| قيد الإصلاح 0 | button | (click) | element vanished before click | unclear |
| فحص الجودة 0 | button | (click) | element vanished before click | unclear |
| جاهزة للإرجاع 0 | button | (click) | element vanished before click | unclear |
| وصلت للفرع 0 | button | (click) | element vanished before click | unclear |
| الكل 14 | button | (click) | element vanished before click | unclear |
| قيد الفحص | button | (click) | XHR GET /api/orders → 200 | works |
| قيد الإصلاح | button | (click) | XHR GET /api/orders → 200 | works |
| فحص الجودة | button | (click) | XHR GET /api/orders → 200 | works |
| جاهزة للإرجاع | button | (click) | XHR GET /api/orders → 200 | works |
| وصلت للفرع | button | (click) | XHR GET /api/orders → 200 | works |
| تم التسليم | button | (click) | XHR GET /api/orders → 200 | works |
| فلتر | button | (click) | DOM Δ 96B | works |
| ترتيب | button | (click) | DOM Δ 3125B | works |
| تجميع | button | (click) | DOM Δ 1692B | works |
| نسخ رابط المتابعة | button | (click) | element vanished before click | unclear |
