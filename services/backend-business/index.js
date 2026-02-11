require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { verifyTransporter } = require('./utils/email');

const app = express();
app.use(morgan('tiny'));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.set('trust proxy', true);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/markettatylu';
async function connectWithRetry(uri, attempts = 0) {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error(`❌ MongoDB connection error (attempt ${attempts + 1}):`, err.message || err);
    if (attempts < 5) {
      const delay = 2000 * (attempts + 1);
      console.log(`Retrying connection in ${delay}ms...`);
      setTimeout(() => connectWithRetry(uri, attempts + 1), delay);
    }
  }
}
connectWithRetry(MONGODB_URI);

// Mount business routes
app.use('/api/checkout', require('./routes/checkout'));
app.use('/invoice', require('./routes/invoices'));
app.use('/api/orders', require('./routes/orders'));
app.use('/reports', require('./routes/reports'));
app.use('/projections', require('./routes/projections'));
app.use('/metrics', require('./routes/metrics'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/debug', require('./routes/debug'));

console.log('-> backend-business routes mounted: /reports, /projections');

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'backend-business' }));
// Also support proxied health path under /api/health for frontend checks
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'backend-business' }));

mongoose.connection.once('connected', () => {
  (async () => {
    try {
      const r = await verifyTransporter();
      if (!r.ok) console.warn('Email transporter not verified');
    } catch (err) { console.error('verifyTransporter error:', err); }
  })();
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`✓ backend-business running on port ${PORT}`));
