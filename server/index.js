const app  = require('./app');
const os   = require('os');
const PORT = process.env.PORT || 3737;

app.listen(PORT, '0.0.0.0', () => {
  const nets = os.networkInterfaces();
  let lan = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { lan = net.address; break; }
    }
  }
  console.log(`✅ Server running on http://localhost:${PORT} (LAN: ${lan}:${PORT})`);
});
