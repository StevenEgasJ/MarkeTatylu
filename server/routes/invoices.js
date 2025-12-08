const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const { sendMail } = require('../utils/email');

const DEFAULT_TAX_RATE = 0.15;
const DEFAULT_CURRENCY = 'USD';
const BASE_SHIPPING_FEE = Number(process.env.BASE_SHIPPING_FEE || 3.5);
const PER_ITEM_SHIPPING_FEE = Number(process.env.PER_ITEM_SHIPPING_FEE || 0.5);
const MAX_SHIPPING_FEE = Number(process.env.MAX_SHIPPING_FEE || 20);

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function buildInvoiceNumber() {
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${Date.now()}-${random}`;
}

function calculateShippingCost(shippingSource = {}, items = []) {
  const manualCost = toNumber(
    shippingSource.costo ?? shippingSource.cost ?? shippingSource.shippingFee ?? null,
    NaN
  );
  if (Number.isFinite(manualCost) && manualCost >= 0) {
    return roundMoney(manualCost);
  }

  const totalUnits = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const incremental = Math.max(0, totalUnits - 1) * PER_ITEM_SHIPPING_FEE;
  const computed = BASE_SHIPPING_FEE + incremental;
  return roundMoney(Math.min(MAX_SHIPPING_FEE, computed));
}

function sanitizeItems(products = []) {
  if (!Array.isArray(products) || products.length === 0) {
    return { error: 'products array is required' };
  }

  const sanitized = [];
  for (const item of products) {
    const rawId = item && (item.productId || item.id || item._id || item.codigo);
    const productId = rawId ? String(rawId).trim() : '';
    const quantity = toNumber(item && (item.quantity ?? item.cantidad), NaN);
    if (!productId) {
      return { error: 'Each item must include productId' };
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return { error: `Invalid productId format: ${productId}` };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Invalid quantity for product ${productId}` };
    }
    sanitized.push({ productId, quantity: Math.floor(quantity) });
  }
  return { items: sanitized };
}

function pickUserFields(userDoc) {
  if (!userDoc) return null;
  return {
    id: userDoc._id ? userDoc._id.toString() : (userDoc.id || undefined),
    nombre: userDoc.nombre || userDoc.firstName || userDoc.name || '',
    apellido: userDoc.apellido || userDoc.lastName || '',
    email: userDoc.email || '',
    telefono: userDoc.telefono || userDoc.phone || '',
    cedula: userDoc.cedula || userDoc.document || ''
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));
}

router.post('/', async (req, res) => {
  let session = null;
  try {
    const body = req.body || {};
    const useTaxRate = Number.isFinite(body.taxRate) ? body.taxRate : DEFAULT_TAX_RATE;
    const invoiceCurrency = (typeof body.currency === 'string' && body.currency.trim())
      ? body.currency.trim().toUpperCase()
      : DEFAULT_CURRENCY;

    const { items: sanitizedItems, error: itemsError } = sanitizeItems(body.products);
    if (itemsError) return res.status(400).json({ error: itemsError });

    let attachedUser = null;
    let invoiceUser = null;

    if (body.userId) {
      attachedUser = await User.findById(body.userId);
      if (!attachedUser) return res.status(404).json({ error: 'User not found' });
      invoiceUser = pickUserFields(attachedUser);
    } else if (body.user && body.user.email && (body.user.nombre || body.user.firstName || body.user.name)) {
      invoiceUser = pickUserFields(body.user);
    } else {
      return res.status(400).json({ error: 'Provide userId or user object with nombre and email' });
    }

    const shippingSource = body.shipping || body.entrega || {};
    const shippingCost = calculateShippingCost(shippingSource, sanitizedItems);
    const shippingInfo = {
      direccion: shippingSource.direccion || shippingSource.address || '',
      referencias: shippingSource.referencias || shippingSource.reference || '',
      contacto: shippingSource.contacto || shippingSource.contact || '',
      instrucciones: shippingSource.instrucciones || shippingSource.instructions || body.comentarios || '',
      fechaEstimada: shippingSource.fechaEstimada || null,
      location: shippingSource.location || shippingSource.latLong || null,
      costo: shippingCost
    };

    const discountValue = Math.max(0, roundMoney(toNumber(body.discount ?? body.totals?.discount ?? 0, 0)));

    const paymentSource = body.payment || body.pago || {};
    const paymentInfo = {
      metodo: paymentSource.metodo || paymentSource.method || body.metodoPago || 'no-especificado',
      metodoPagoNombre: paymentSource.metodoPagoNombre || paymentSource.methodName || paymentSource.metodo || paymentSource.method || body.metodoPago || 'no-especificado',
      referencia: paymentSource.referencia || paymentSource.reference || '',
      estado: paymentSource.estado || 'pagado'
    };

    session = await mongoose.startSession();

    let orderResponse = null;
    let invoicePayload = null;
    let committedOrder = null;

    await session.withTransaction(async () => {
      const ids = sanitizedItems.map(it => mongoose.Types.ObjectId(it.productId));
      const productDocs = await Product.find({ _id: { $in: ids } }).session(session);
      const productMap = new Map(productDocs.map(doc => [doc._id.toString(), doc]));

      if (productDocs.length !== sanitizedItems.length) {
        const missing = sanitizedItems
          .filter(it => !productMap.has(it.productId))
          .map(it => it.productId);
        const err = new Error(`Products not found: ${missing.join(', ')}`);
        err.status = 404;
        throw err;
      }

      const invoiceItems = [];
      let subtotal = 0;

      for (const item of sanitizedItems) {
        const product = productMap.get(item.productId);
        if (!product) {
          const err = new Error(`Product ${item.productId} not found`);
          err.status = 404;
          throw err;
        }
        const available = toNumber(product.stock, 0);
        if (available < item.quantity) {
          const err = new Error(`Insufficient stock for ${product.nombre || product._id}`);
          err.status = 400;
          throw err;
        }

        product.stock = available - item.quantity;
        await product.save({ session });

        const basePrice = toNumber(product.precio, 0);
        const discountPct = toNumber(product.descuento, 0);
        const priceAfterDiscount = roundMoney(basePrice * (1 - discountPct / 100));
        const lineTotal = roundMoney(priceAfterDiscount * item.quantity);
        subtotal = roundMoney(subtotal + lineTotal);

        invoiceItems.push({
          productId: product._id.toString(),
          nombre: product.nombre,
          quantity: item.quantity,
          unitPrice: priceAfterDiscount,
          currency: invoiceCurrency,
          discountPercentage: discountPct,
          lineTotal
        });
      }

      const taxes = roundMoney(subtotal * useTaxRate);
      const totalsForUi = {
        subtotal,
        iva: taxes,
        envio: shippingCost,
        discount: discountValue,
        total: roundMoney(Math.max(0, subtotal + taxes + shippingCost - discountValue))
      };

      const orderProducts = invoiceItems.map(line => ({
        id: line.productId,
        nombre: line.nombre,
        cantidad: line.quantity,
        precio: line.unitPrice,
        subtotal: line.lineTotal,
        currency: line.currency
      }));

      const resumen = {
        cliente: invoiceUser,
        productos: orderProducts,
        totales: totalsForUi,
        entrega: shippingInfo,
        pago: paymentInfo
      };

      const invoiceNumber = buildInvoiceNumber();
      resumen.invoiceNumber = invoiceNumber;

      const orderItemsForDb = invoiceItems.map(line => ({
        productId: line.productId,
        cantidad: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        currency: line.currency
      }));

      const orderDoc = new Order({
        userId: attachedUser ? attachedUser._id : undefined,
        items: orderItemsForDb,
        resumen,
        estado: 'confirmado',
        fecha: new Date()
      });

      await orderDoc.save({ session });

      if (attachedUser) {
        const userForUpdate = await User.findById(attachedUser._id).session(session);
        if (userForUpdate) {
          userForUpdate.orders = userForUpdate.orders || [];
          userForUpdate.orders.push({
            orderId: orderDoc._id,
            codigo: orderDoc.id,
            fecha: orderDoc.fecha,
            resumen
          });
          userForUpdate.cart = [];
          await userForUpdate.save({ session });
        }
      }

      committedOrder = orderDoc;
      orderResponse = {
        _id: orderDoc._id,
        id: orderDoc.id,
        numeroOrden: orderDoc.id,
        numeroFactura: invoiceNumber,
        fecha: orderDoc.fecha,
        estado: orderDoc.estado,
        cliente: invoiceUser,
        productos: orderProducts,
        totales: totalsForUi,
        entrega: shippingInfo,
        pago: paymentInfo
      };

      invoicePayload = {
        invoiceNumber,
        issuedAt: new Date().toISOString(),
        currency: invoiceCurrency,
        user: invoiceUser,
        items: invoiceItems,
        totals: {
          subtotal,
          taxRate: useTaxRate,
          taxes,
          shipping: shippingCost,
          discount: discountValue,
          total: totalsForUi.total
        },
        orderId: orderDoc._id,
        orderCode: orderDoc.id
      };
    });

    if (invoiceUser.email && committedOrder) {
      (async () => {
        try {
          const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 4000}`;
          const invoiceLink = `${base}/confirmacion.html?orderId=${committedOrder._id}`;
          const html = `<p>Hola ${escapeHtml(invoiceUser.nombre || invoiceUser.email)},</p>
            <p>Tu factura #${escapeHtml(orderResponse.numeroFactura)} está lista.</p>
            <p>Puedes consultarla aquí: <a href="${invoiceLink}">Ver factura</a></p>`;
          const result = await sendMail({
            to: invoiceUser.email,
            subject: 'Factura disponible - Tatylu',
            html
          });
          if (!result.ok) console.error('Invoice email failed', result.error);
        } catch (e) {
          console.error('Error sending invoice email:', e);
        }
      })();
    }

    res.status(201).json({
      success: true,
      order: orderResponse,
      invoice: invoicePayload
    });
  } catch (err) {
    console.error('Error generating invoice:', err);
    const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
    res.status(status).json({ error: err.message || 'Unable to generate invoice' });
  } finally {
    if (session) {
      try {
        await session.endSession();
      } catch (e) {
        console.warn('Could not end invoice session:', e);
      }
    }
  }
});

module.exports = router;
