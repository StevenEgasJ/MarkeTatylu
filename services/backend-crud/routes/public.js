const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET / - public home content (e.g., featured products)
router.get('/', async (req, res) => {
  try {
    const featured = await Product.find().limit(10).sort({ fechaCreacion: -1 }).lean();
    res.json({ featured });
  } catch (err) {
    console.error('Public root error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;