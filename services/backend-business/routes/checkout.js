const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const {authMiddleware} = require('../middleware/auth');

const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendMail } = require('../utils/email');

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

// GET /api/checkout/:userId - get all orders for a user with total sum
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId format' });
    }

    const orders = await Order.find({ userId })
      .sort({ fecha: -1 })
      .lean();

    let totalGeneral = 0;
    let totalSubtotal = 0;
    let totalIva = 0;
    let totalEnvio = 0;
    let totalItems = 0;

    orders.forEach(order => {
      if (order.resumen) {
        totalSubtotal += order.resumen.subtotal || 0;
        totalIva += order.resumen.iva || 0;
        totalEnvio += order.resumen.envio || 0;
        totalGeneral += order.resumen.total || 0;
        totalItems += order.resumen.itemCount || 0;
      }
    });

    res.json({
      userId,
      totalOrdenes: orders.length,
      orders,
      resumenTotal: {
        subtotal: Math.round(totalSubtotal * 100) / 100,
        iva: Math.round(totalIva * 100) / 100,
        envio: Math.round(totalEnvio * 100) / 100,
        total: Math.round(totalGeneral * 100) / 100,
        itemCount: totalItems
      }
    });
  } catch (err) {
    console.error('Error getting user orders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/checkout - purchase cart items atomically
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { items, resumen, shipping } = req.body; // items: [{ id, cantidad }]

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

  const MAX_TX_RETRIES = 3;
  let attempt = 0;
  let finalErr = null;
  let committedOrder = null;
  let committedUser = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  while (attempt < MAX_TX_RETRIES) {
    attempt += 1;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        for (const it of items) {
          const prodId = it.id;
          const qty = parseInt(it.cantidad || it.cant || it.quantity || it.cantidad, 10) || 0;
          if (qty <= 0) throw new Error('Invalid quantity');
          let product = null;
          try {
            if (mongoose.Types.ObjectId.isValid(prodId)) {
              product = await Product.findById(prodId).session(session);
            }
          } catch (e) {}

          if (!product) {
            product = await Product.findOne({ $or: [{ nombre: prodId }, { codigo: prodId }] }).session(session);
          }

          if (!product) throw new Error(`Product not found: ${prodId}`);
          if ((product.stock || 0) < qty) throw new Error(`Insufficient stock for ${product.nombre}`);

          product.stock = product.stock - qty;
          await product.save({ session });
        }

        const order = new Order({ userId, items, resumen: resumen || {}, estado: 'confirmado', fecha: new Date() });
        await order.save({ session });

        const user = await User.findById(userId).session(session);
        if (user) {
          user.orders = user.orders || [];
          user.orders.push({ orderId: order._id, codigo: order.id, fecha: order.fecha, resumen: order.resumen });
          user.cart = [];
          await user.save({ session });
        }

        committedOrder = order;
        committedUser = user;
      });

      session.endSession();

      try { console.log('Order saved to DB', { orderId: committedOrder._id.toString(), userId }); } catch (e) { console.warn('Could not log saved order info', e); }

      (async () => {
        try {
          if (committedUser && committedUser.email) {
            const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT||4000}`;
            const invoiceLink = `${base}/confirmacion.html?orderId=${committedOrder._id}`;
            const html = `<p>Hola ${escapeHtml(committedUser.nombre || committedUser.email)},</p>
              <p>Gracias por tu compra. Puedes ver tu factura en el siguiente enlace:</p>
              <p><a href="${invoiceLink}">Ver factura</a></p>`;
            const result = await sendMail({ to: committedUser.email, subject: 'Tu compra en Tatylu - Factura', html });
            if (!result.ok) console.error('Invoice email failed', result.error);
          }
        } catch (e) { console.error('Error sending invoice email:', e); }
      })();

      return res.json({ success: true, orderId: committedOrder._id, orderCode: committedOrder.id });
    } catch (err) {
      try { await session.abortTransaction(); } catch (e) { }
      session.endSession();
      finalErr = err;
      console.error(`Checkout attempt ${attempt} failed:`, err && (err.message || err));
      const isTransient = (err && typeof err.hasErrorLabel === 'function' && (err.hasErrorLabel('UnknownTransactionCommitResult') || err.hasErrorLabel('TransientTransactionError'))) || (err && err.message && err.message.includes('Write conflict'));
      if (isTransient && attempt < MAX_TX_RETRIES) { const backoffMs = 100 * attempt; console.warn(`Transient transaction error detected, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_TX_RETRIES})`); await sleep(backoffMs); continue; }
      break;
    }
  }

  console.error('Checkout failed after retries:', finalErr && (finalErr.message || finalErr));
  if (finalErr && finalErr.stack) console.error('Checkout final error stack:', finalErr.stack);
  try { console.error('Checkout request metadata:', { hasAuthHeader: !!req.headers.authorization, itemsCount: Array.isArray(items) ? items.length : 0, resumenPresent: !!resumen }); } catch (e) { console.warn('Could not log checkout request metadata', e); }
  res.status(400).json({ error: (finalErr && finalErr.message) || 'Checkout failed' });
});

module.exports = router;