const express = require('express');
const cors = require('cors');
const os = require('os');
const ordersRouter = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3737;

function getLanIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// Fix #4: restrict CORS to localhost and LAN origins only
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

app.use('/api/orders', ordersRouter);

// Returns LAN IP so the label QR code can use it
app.get('/api/config', (req, res) => res.json({ ip: getLanIP(), port: 5173 }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT} (LAN: ${getLanIP()}:${PORT})`);
});
