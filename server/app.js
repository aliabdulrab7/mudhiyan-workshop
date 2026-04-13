const express = require('express');
const cors = require('cors');
const os = require('os');

const ordersRouter = require('./routes/orders');
const authRouter   = require('./routes/auth');
const trackRouter  = require('./routes/track');
const adminRouter  = require('./routes/admin');

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

app.use('/api/auth',   authRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/track',  trackRouter);
app.use('/api/admin',  adminRouter);

module.exports = app;
