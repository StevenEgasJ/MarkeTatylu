const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');

// GET /api/dbstatus - quick status of DB: connection state and collection counts
router.get('/dbstatus', async (req, res) => {
  try {
    const state = mongoose.connection.readyState; // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
    const productsCount = await Product.countDocuments().catch(() => null);
    const usersCount = await User.countDocuments().catch(() => null);
    const ordersCount = await Order.countDocuments().catch(() => null);

    // sample products (first 10)
    const sampleProducts = await Product.find().limit(10).lean().select('nombre precio stock imagen categoria').catch(() => []);

    res.json({
      state,
      productsCount,
      usersCount,
      ordersCount,
      sampleProducts
    });
  } catch (err) {
    console.error('Error in /api/dbstatus:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
