const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');

// POST /api/checkout - purchase cart items atomically
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { items, resumen, shipping } = req.body; // items: [{ id, cantidad }]

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate and decrement stock for each item
    for (const it of items) {
      const prodId = it.id;
      const qty = parseInt(it.cantidad || it.cant || it.quantity || it.cantidad, 10) || 0;
      if (qty <= 0) throw new Error('Invalid quantity');

      const product = await Product.findOne({ _id: prodId }).session(session);
      if (!product) throw new Error(`Product not found: ${prodId}`);
      if ((product.stock || 0) < qty) throw new Error(`Insufficient stock for ${product.nombre}`);

      // Decrement stock
      product.stock = product.stock - qty;
      await product.save({ session });
    }

    // Create order
    const order = new Order({
      userId,
      items,
      resumen: resumen || {},
      estado: 'confirmado',
      fecha: new Date()
    });

    await order.save({ session });

    // Attach order to user and clear user's cart
    const user = await User.findById(userId).session(session);
    if (user) {
      user.orders = user.orders || [];
      user.orders.push({ orderId: order._id, fecha: order.fecha, resumen: order.resumen });
      user.cart = [];
      await user.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error('Checkout error:', err.message || err);
    res.status(400).json({ error: err.message || 'Checkout failed' });
  }
});

module.exports = router;
