const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const { authMiddleware } = require('../middleware/auth');

// NOTE: Auth removed intentionally so orders APIs can be used without authentication
// GET /api/orders - list recent orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ fecha: -1 }).limit(200).lean();
    res.json(orders);
  } catch (err) {
    console.error('Error listing orders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/user - get orders for authenticated user
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const orders = await Order.find({ userId: userId }).sort({ fecha: -1 }).lean();
    res.json(orders);
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper: resolve products by either Mongo _id or numeric/string `id` field
async function resolveProductsByIdentifiers(identifiers) {
  const objs = [];
  const numeric = [];
  for (const id of identifiers) {
    if (!id) continue;
    const s = String(id).trim();
    // treat 24-char hex as ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(s)) objs.push(s);
    else numeric.push(s);
  }

  const queries = [];
  if (objs.length) queries.push(Product.find({ _id: { $in: objs } }).lean());
  if (numeric.length) queries.push(Product.find({ id: { $in: numeric.map(n => (isNaN(n) ? n : Number(n))) } }).lean());

  const results = (await Promise.all(queries)).flat();
  const map = new Map();
  for (const p of results) {
    if (p._id) map.set(p._id.toString(), p);
    if (p.id != null) map.set(String(p.id), p);
  }
  return map;
}

// POST /api/orders/calculate - calculate order price breakdown
router.post('/calculate', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // Fetch product info for items that provide productId (supports Mongo _id or numeric id)
    const productIds = Array.from(new Set(items.filter(i => i.productId).map(i => i.productId)));
    const prodMap = productIds.length ? await resolveProductsByIdentifiers(productIds) : new Map();

    let subtotal = 0;
    let discountTotal = 0;

    const computedItems = items.map(it => {
      const qty = Number(it.cantidad || it.quantity || 0);
      let unitPrice = it.precio != null ? Number(it.precio) : 0;
      let nombre = it.nombre || it.name || '';
      let descuento = 0;

      const lookupKey = it.productId ? String(it.productId) : null;
      if (lookupKey && prodMap.has(lookupKey)) {
        const p = prodMap.get(lookupKey);
        nombre = nombre || p.nombre;
        unitPrice = p.precio;
        descuento = Number(p.descuento || 0);
      }

      const priceAfterDiscount = +(unitPrice * (1 - (descuento / 100)));
      const lineTotal = +(priceAfterDiscount * qty);
      subtotal += lineTotal;
      discountTotal += +( (unitPrice - priceAfterDiscount) * qty );

      return {
        productId: it.productId,
        nombre,
        precioUnit: +unitPrice.toFixed(2),
        descuento: +descuento.toFixed(2),
        precioConDescuento: +priceAfterDiscount.toFixed(2),
        cantidad: qty,
        total: +lineTotal.toFixed(2)
      };
    });

    const taxRate = Number(req.body.taxRate ?? process.env.DEFAULT_TAX_RATE ?? 0);
    const taxes = +(subtotal * taxRate);
    const total = +(subtotal + taxes).toFixed(2);

    const resumen = {
      subtotal: +subtotal.toFixed(2),
      discountTotal: +discountTotal.toFixed(2),
      taxRate: +taxRate,
      taxes: +taxes.toFixed(2),
      total: +total,
      items: computedItems
    };

    res.json({ resumen });
  } catch (err) {
    console.error('Error calculating order:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders - create and save order with computed resumen if needed
router.post('/', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // Compute resumen if not provided
    let resumen = req.body.resumen;
    if (!resumen) {
      const productIdsInline = Array.from(new Set(items.filter(i => i.productId).map(i => i.productId)));
      const prodMapInline = productIdsInline.length ? await resolveProductsByIdentifiers(productIdsInline) : new Map();

      let subtotal = 0;
      let discountTotal = 0;

      const computedItems = items.map(it => {
        const qty = Number(it.cantidad || it.quantity || 0);
        let unitPrice = it.precio != null ? Number(it.precio) : 0;
        let nombre = it.nombre || it.name || '';
        let descuento = 0;

        const lookupKey = it.productId ? String(it.productId) : null;
        if (lookupKey && prodMapInline.has(lookupKey)) {
          const p = prodMapInline.get(lookupKey);
          nombre = nombre || p.nombre;
          unitPrice = p.precio;
          descuento = Number(p.descuento || 0);
        }

        const priceAfterDiscount = +(unitPrice * (1 - (descuento / 100)));
        const lineTotal = +(priceAfterDiscount * qty);
        subtotal += lineTotal;
        discountTotal += +( (unitPrice - priceAfterDiscount) * qty );

        return {
          productId: it.productId,
          nombre,
          precioUnit: +unitPrice.toFixed(2),
          descuento: +descuento.toFixed(2),
          precioConDescuento: +priceAfterDiscount.toFixed(2),
          cantidad: qty,
          total: +lineTotal.toFixed(2)
        };
      });

      const taxRate = Number(req.body.taxRate ?? process.env.DEFAULT_TAX_RATE ?? 0);
      const taxes = +(subtotal * taxRate);
      const total = +(subtotal + taxes).toFixed(2);

      resumen = {
        subtotal: +subtotal.toFixed(2),
        discountTotal: +discountTotal.toFixed(2),
        taxRate: +taxRate,
        taxes: +taxes.toFixed(2),
        total: +total,
        items: computedItems
      };
    }

    // Calculate total if not provided
    const subtotalVal = Number(req.body.subtotal) || resumen?.subtotal || 0;
    const ivaVal = Number(req.body.iva) || 0;
    const envioVal = Number(req.body.envio) || 0;
    const discountVal = Number(req.body.discount) || 0;
    const totalVal = Number(req.body.total) || (subtotalVal + ivaVal + envioVal - discountVal);

    const orderPayload = {
      items,
      resumen,
      estado: req.body.estado || 'pendiente',
      userId: req.body.userId,
      direccion: req.body.direccion,
      ciudad: req.body.ciudad,
      telefono: req.body.telefono,
      metodoPago: req.body.metodoPago,
      tipoEnvio: req.body.tipoEnvio,
      cliente: req.body.cliente,
      subtotal: subtotalVal,
      iva: ivaVal,
      envio: envioVal,
      discount: discountVal,
      total: totalVal
    };

    const order = new Order(orderPayload);
    await order.save();

    // Reduce stock for each product if order is confirmed
    if (orderPayload.estado === 'confirmado') {
      for (const item of items) {
        const productId = item.productId;
        const qty = Number(item.quantity || item.cantidad || 0);
        if (productId && qty > 0) {
          try {
            await Product.findOneAndUpdate(
              { $or: [{ _id: productId }, { id: productId }] },
              { $inc: { stock: -qty } }
            );
          } catch (stockErr) {
            console.warn('Could not reduce stock for product:', productId, stockErr.message);
          }
        }
      }
    }

    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/orders/:id - update order
router.put('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/orders/:id - delete order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    console.error('Error deleting order:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id - get order by id (placed after other routes to avoid conflicts)
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    console.error('Error fetching order by id:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
