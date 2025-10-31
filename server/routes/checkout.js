const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authMiddleware = require('../middleware/auth');

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendMail } = require('../utils/email');

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

// POST /api/checkout - purchase cart items atomically
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { items, resumen, shipping } = req.body; // items: [{ id, cantidad }]

  // Debug logging: incoming checkout payload and authenticated user
  try {
    console.log('Incoming checkout request:', {
      userId: userId || null,
      hasAuthHeader: !!req.headers.authorization,
      itemsCount: Array.isArray(items) ? items.length : 0,
      resumenPresent: !!resumen,
      shippingPresent: !!shipping
    });
  } catch (e) {
    console.warn('Could not log checkout debug info', e);
  }

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
      // Try to find product by ObjectId, and fallback to name/code if necessary (compatibility with legacy local IDs)
      let product = null;
      try {
        if (mongoose.Types.ObjectId.isValid(prodId)) {
          product = await Product.findById(prodId).session(session);
        }
      } catch (e) {
        // ignore cast errors and fallback
      }

      if (!product) {
        product = await Product.findOne({ $or: [{ nombre: prodId }, { codigo: prodId }] }).session(session);
      }

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
    // Detailed log after saving the order
    try {
      console.log('Order saved to DB', { orderId: order._id.toString(), userId });
    } catch (e) {
      console.warn('Could not log saved order info', e);
    }

    // Attach order to user and clear user's cart
    const user = await User.findById(userId).session(session);
    if (user) {
      user.orders = user.orders || [];
      user.orders.push({ orderId: order._id, fecha: order.fecha, resumen: order.resumen });
      user.cart = [];
      await user.save({ session });
      // Log after user updated
      try {
        console.log('User updated with new order', { userId: user._id.toString(), ordersCount: (user.orders || []).length });
      } catch (e) {
        console.warn('Could not log user update info', e);
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Send invoice email to user (best-effort, do not block response)
    (async () => {
      try {
        if (user && user.email) {
          const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT||4000}`;
          const invoiceLink = `${base}/confirmacion.html?orderId=${order._id}`;
          const html = `<p>Hola ${escapeHtml(user.nombre || user.email)},</p>
            <p>Gracias por tu compra. Puedes ver tu factura en el siguiente enlace:</p>
            <p><a href="${invoiceLink}">Ver factura</a></p>`;
          const result = await sendMail({ to: user.email, subject: 'Tu compra en Tatylu - Factura', html });
          if (!result.ok) console.error('Invoice email failed', result.error);
        }
      } catch (e) {
        console.error('Error sending invoice email:', e);
      }
    })();

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error('Checkout error message:', err.message || err);
    // Include stack when available for deeper debugging
    if (err && err.stack) console.error('Checkout error stack:', err.stack);
    // Log some request metadata to help root-cause analysis (avoid logging full sensitive headers)
    try {
      console.error('Checkout request metadata:', {
        hasAuthHeader: !!req.headers.authorization,
        itemsCount: Array.isArray(items) ? items.length : 0,
        resumenPresent: !!resumen
      });
    } catch (e) {
      console.warn('Could not log checkout request metadata', e);
    }
    // Return detailed error message to client for debugging
    res.status(400).json({ error: err.message || 'Checkout failed' });
  }
});

module.exports = router;
