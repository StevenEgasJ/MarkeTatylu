const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'rail_metrics.json');

async function ensureLogFile() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    try { await fs.access(LOG_FILE); } catch (e) { await fs.writeFile(LOG_FILE, JSON.stringify([]), 'utf8'); }
  } catch (err) {
    console.error('Could not ensure metrics log file:', err);
  }
}

async function appendMetric(entry) {
  try {
    await ensureLogFile();
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    const arr = JSON.parse(raw || '[]');
    arr.push(entry);
    const capped = arr.slice(-1000);
    await fs.writeFile(LOG_FILE, JSON.stringify(capped, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('appendMetric failed:', err);
    return false;
  }
}

router.post('/rail', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) return res.status(400).json({ error: 'Missing payload' });
    const entry = { receivedAt: new Date().toISOString(), ip: req.ip || null, payload };
    appendMetric(entry).catch(e => console.warn('Could not persist metric:', e));
    console.log('METRICS /rail received:', JSON.stringify(payload).slice(0, 500));
    return res.json({ ok: true });
  } catch (err) {
    console.error('POST /metrics/rail failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

router.get('/rail', async (req, res) => {
  try {
    await ensureLogFile();
    const raw = await fs.readFile(LOG_FILE, 'utf8');
    const arr = JSON.parse(raw || '[]');
    return res.json({ total: arr.length, items: arr.slice(-200).reverse() });
  } catch (err) {
    console.error('GET /metrics/rail failed:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;