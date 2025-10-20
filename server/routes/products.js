const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET /api/products - list products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ fechaCreacion: -1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/products - create (basic, no auth for scaffold)
router.post('/', async (req, res) => {
  try {
    const p = new Product(req.body);
    const saved = await p.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Invalid data' });
  }
});

module.exports = router;
