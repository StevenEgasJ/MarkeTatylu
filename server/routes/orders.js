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
      // reuse local calculation logic
      const calcReq = { body: { items, taxRate: req.body.taxRate } };
      // directly call calculation logic to avoid HTTP overhead
      const fakeReq = { body: { items, taxRate: req.body.taxRate } };
      const fakeRes = {
        jsonPayload: null,
        json(obj) { this.jsonPayload = obj; }
      };
      // call calculation handler functionally (support numeric product id or ObjectId)
      await (async function calculateInline() {
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
      })();
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

// GET /api/orders/top?limit=10 - return top orders by total amount
router.get('/top', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const orders = await Order.find().lean();

    const computeTotal = o => {
      // Helper: parse numbers safely
      const parseNum = v => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      // Common total locations
      const candidates = [
        parseNum(o?.resumen?.total),
        parseNum(o?.resumen?.totales?.total),
        parseNum(o?.totales?.total),
        parseNum(o?.resumen?.totales?.subtotal),
        parseNum(o?.resumen?.totalAmount)
      ];
      for (const c of candidates) if (c !== null) return Math.round(c * 100) / 100;

      // Sum conocido item arrays (resumen.productos or items) supporting multiple fields
      const sumItems = arr => {
        return arr.reduce((s, it) => {
          const v = parseNum(it.total) ?? parseNum(it.subtotal) ?? parseNum(it.lineTotal) ?? parseNum(it.precio * (it.cantidad || it.quantity) ) ?? 0;
          return s + v;
        }, 0);
      };

      if (Array.isArray(o?.resumen?.productos) && o.resumen.productos.length) {
        return Math.round(sumItems(o.resumen.productos) * 100) / 100;
      }

      if (Array.isArray(o?.items) && o.items.length) {
        return Math.round(sumItems(o.items) * 100) / 100;
      }

      return 0;
    };

    const sorted = orders.map(o => ({ ...o, computedTotal: computeTotal(o) }))
                         .sort((a, b) => b.computedTotal - a.computedTotal)
                         .slice(0, limit);
    res.json(sorted);
  } catch (err) {
    console.error('Error fetching top orders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Small fetch helper that falls back to node-fetch when running on older Node versions
const doFetch = (...args) => {
  if (global.fetch) return global.fetch(...args);
  try {
    return require('node-fetch')(...args);
  } catch (err) {
    throw new Error('Fetch is not available and node-fetch is not installed. Please run on Node >=18 or install node-fetch.');
  }
};

// POST /api/orders/microservice-create - demonstrates an API that calls other APIs
// It calls /api/orders/calculate and then /api/orders to persist
router.post('/microservice-create', async (req, res) => {
  try {
    const port = process.env.PORT || 4000;
    const baseUrl = `http://localhost:${port}`;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // call calculate API (use /orders prefix)
    const calcResp = await doFetch(`${baseUrl}/orders/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, taxRate: req.body.taxRate })
    });
    if (!calcResp.ok) {
      const txt = await calcResp.text();
      return res.status(502).json({ error: 'Calculation service failed', details: txt });
    }
    const calcJson = await calcResp.json();

    // call create API with computed resumen (use /orders prefix)
    const saveResp = await doFetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, resumen: calcJson.resumen, userId: req.body.userId })
    });
    if (!saveResp.ok) {
      const txt = await saveResp.text();
      return res.status(502).json({ error: 'Order save service failed', details: txt });
    }
    const saved = await saveResp.json();
    res.status(201).json({ saved, via: ['calculate', 'orders'] });
  } catch (err) {
    console.error('Error in microservice-create:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id - placed after fixed routes to avoid path conflicts
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
