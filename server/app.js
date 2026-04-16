const express = require('express');
const cors = require('cors');
const os = require('os');

const ordersRouter     = require('./routes/orders');
const authRouter       = require('./routes/auth');
const trackRouter      = require('./routes/track');
const adminRouter      = require('./routes/admin');
const customersRouter  = require('./routes/customers');
const orderItemsRouter = require('./routes/orderItems');
const servicesRouter   = require('./routes/services');
const techRouter       = require('./routes/technicians');
const inventoryRouter  = require('./routes/inventory');
const { errorToHttpStatus } = require('./errors');

// ── Phase 2: wire payment validator + notification hook ───────────────────────
const OrderService       = require('./services/OrderService');
const NotificationService = require('./services/NotificationService');
const { PaymentRequiredError } = require('./errors');

// Payment is required when shop delivers to customer (returned_to_shop → delivered)
OrderService.registerPaymentValidator((order) => {
  if (!order.payment_confirmed) {
    throw new PaymentRequiredError();
  }
});

OrderService.registerNotificationHook((status, order) => {
  return NotificationService.notify(status, order);
});

const app = express();

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const ALLOWED_ORIGIN = process.env.PUBLIC_HOST
  ? new RegExp(`^https?://${process.env.PUBLIC_HOST.replace('.', '\\.')}(:\\d+)?$`)
  : null;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGIN && ALLOWED_ORIGIN.test(origin)) return cb(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

app.get('/api/config', (_req, res) => {
  if (process.env.PUBLIC_HOST) {
    return res.json({ ip: process.env.PUBLIC_HOST, port: 443, protocol: 'https' });
  }
  res.json({ ip: getLanIP(), port: 5173 });
});
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth',        authRouter);
app.use('/api/orders',      ordersRouter);
app.use('/api/track',       trackRouter);
app.use('/api/admin',       adminRouter);
app.use('/api/customers',   customersRouter);
app.use('/api/order-items', orderItemsRouter);
app.use('/api/services',    servicesRouter);
app.use('/api/technicians', techRouter);
app.use('/api/inventory',   inventoryRouter);

// 8.2 — Catch-all 404 for unmatched routes — returns JSON, not Express HTML page
app.use((_req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

// 8.2 — Global error handler (last middleware)
// Catches any error passed via next(err) or thrown inside async middleware.
// No stack traces in production — avoids leaking internals.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = errorToHttpStatus(err);
  const message = process.env.NODE_ENV === 'production' && status >= 500
    ? 'خطأ في الخادم'
    : err.message;
  res.status(status).json({ error: message });
});

module.exports = app;
