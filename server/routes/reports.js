const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Report = require('../models/Report');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundMoney(v) {
  return Math.round(v * 100) / 100;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation: build report data from orders collection
// ─────────────────────────────────────────────────────────────────────────────

async function buildReportData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  // Fetch ALL orders (no filter by estado to include all sales)
  const orders = await Order.find({}).lean();
  
  console.log(`[buildReportData] Found ${orders.length} orders in database`);

  // Fetch all products to get names and ids
  const allProducts = await Product.find({}).lean();
  const productMap = new Map();
  for (const p of allProducts) {
    productMap.set(p._id.toString(), {
      id: p.id || '',
      nombre: p.nombre || p.name || 'Producto sin nombre',
      categoria: p.categoria || p.category || 'otros',
      precio: toNumber(p.precio || p.price, 0)
    });
  }

  let totalVentas = 0;
  let totalOrdenes = orders.length;
  let totalProductosVendidos = 0;
  let ventasHoy = 0;
  let ventasSemana = 0;
  let ventasMes = 0;
  let ordenesHoy = 0;
  let ordenesSemana = 0;
  let ordenesMes = 0;

  const productSales = {}; // productId -> { nombre, cantidadVendida, ingresos }
  const categoryRevenue = {}; // categoria -> revenue

  for (const order of orders) {
    const orderDate = new Date(order.fecha || order.createdAt || 0);
    const orderTotal = toNumber(order.resumen?.totales?.total ?? order.totales?.total ?? 0, 0);

    totalVentas += orderTotal;

    const isToday = orderDate >= todayStart;
    const isThisWeek = orderDate >= weekStart;
    const isThisMonth = orderDate >= monthStart;

    if (isToday) {
      ventasHoy += orderTotal;
      ordenesHoy += 1;
    }
    if (isThisWeek) {
      ventasSemana += orderTotal;
      ordenesSemana += 1;
    }
    if (isThisMonth) {
      ventasMes += orderTotal;
      ordenesMes += 1;
    }

    // Aggregate products
    const items = order.resumen?.productos || order.productos || order.items || [];
    for (const item of items) {
      const pid = String(item.productId || item.id || item._id || 'unknown');
      const qty = toNumber(item.cantidad || item.quantity, 0);
      
      // Get product info from database
      const productInfo = productMap.get(pid) || {};
      
      // Calculate line revenue - try multiple sources for price
      let unitPrice = toNumber(item.precio || item.unitPrice || item.price, 0);
      if (unitPrice === 0 && productInfo.precio) {
        unitPrice = toNumber(productInfo.precio, 0);
      }
      let lineRevenue = toNumber(item.subtotal || item.lineTotal, 0);
      if (lineRevenue === 0 && unitPrice > 0) {
        lineRevenue = roundMoney(unitPrice * qty);
      }
      
      const nombre = productInfo.nombre || item.nombre || item.productName || 'Producto desconocido';
      const productNumericId = productInfo.id || '';
      const categoria = productInfo.categoria || item.categoria || item.category || 'otros';

      totalProductosVendidos += qty;

      if (!productSales[pid]) {
        productSales[pid] = { productId: pid, id: productNumericId, nombre, cantidadVendida: 0, ingresos: 0, categoria };
      }
      productSales[pid].cantidadVendida += qty;
      productSales[pid].ingresos += lineRevenue;

      categoryRevenue[categoria] = (categoryRevenue[categoria] || 0) + lineRevenue;
    }
  }

  // Top 10 products by quantity sold
  const topProductos = Object.values(productSales)
    .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
    .slice(0, 10)
    .map((p) => ({
      productId: mongoose.Types.ObjectId.isValid(p.productId) ? p.productId : undefined,
      id: p.id || '',
      nombre: p.nombre,
      cantidadVendida: p.cantidadVendida,
      ingresos: roundMoney(p.ingresos)
    }));

  // Round category revenues
  const ventasPorCategoria = {};
  for (const cat of Object.keys(categoryRevenue)) {
    ventasPorCategoria[cat] = roundMoney(categoryRevenue[cat]);
  }

  return {
    tipo: 'snapshot',
    generadoEn: now,
    periodoInicio: monthStart,
    periodoFin: now,
    totalVentas: roundMoney(totalVentas),
    totalOrdenes,
    totalProductosVendidos,
    ventasHoy: roundMoney(ventasHoy),
    ventasSemana: roundMoney(ventasSemana),
    ventasMes: roundMoney(ventasMes),
    ordenesHoy,
    ordenesSemana,
    ordenesMes,
    topProductos,
    ventasPorCategoria
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find user by _id or numeric id field
// ─────────────────────────────────────────────────────────────────────────────

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  const idNum = parseInt(idStr, 10);
  
  console.log(`[findUserByIdentifier] Searching for: "${idStr}", as number: ${idNum}`);
  
  // Try by MongoDB _id first
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
    const byObjectId = await User.findById(idStr);
    if (byObjectId) {
      console.log(`[findUserByIdentifier] Found by _id`);
      return byObjectId;
    }
  }
  
  // Try by id field using $or to match both string and number
  const orConditions = [{ id: idStr }];
  if (!isNaN(idNum)) {
    orConditions.push({ id: idNum });
  }
  orConditions.push({ email: idStr });
  
  const user = await User.findOne({ $or: orConditions });
  if (user) {
    console.log(`[findUserByIdentifier] Found user: ${user.email}`);
    return user;
  }
  
  // Debug: list all user ids in database
  const allUsers = await User.find({}, { id: 1, email: 1, _id: 1 }).limit(10).lean();
  console.log(`[findUserByIdentifier] Not found. Sample users in DB:`, JSON.stringify(allUsers));
  
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find product by _id or numeric id field
// ─────────────────────────────────────────────────────────────────────────────

async function findProductByIdentifier(identifier, session = null) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  
  // Try by MongoDB _id first
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
    const query = Product.findById(idStr);
    if (session) query.session(session);
    const byObjectId = await query;
    if (byObjectId) return byObjectId;
  }
  // Try by numeric id field (as string or number)
  let query = Product.findOne({ id: idStr });
  if (session) query.session(session);
  const byIdStr = await query;
  if (byIdStr) return byIdStr;
  
  query = Product.findOne({ id: Number(idStr) });
  if (session) query.session(session);
  return await query;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /reports
// If body contains userId + products: creates an order first, then generates report
// Otherwise just generates a report from existing orders
// Body: { userId?, products?, shipping?, payment?, save?, notas? }
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', authMiddleware, async (req, res) => {
  let session = null;
  try {
    const body = req.body || {};
    const shouldSave = body.save !== false && body.save !== 'false';
    const notas = body.notas || body.notes || '';

    let createdOrder = null;

    // If userId and products are provided, create an order first
    if (body.userId && body.products && Array.isArray(body.products) && body.products.length > 0) {
      
      // Find user by id (numeric) or _id
      const attachedUser = await findUserByIdentifier(body.userId);
      if (!attachedUser) {
        return res.status(404).json({ error: `User not found: ${body.userId}` });
      }

      const cliente = {
        id: attachedUser._id.toString(),
        odooId: attachedUser.id || '',
        nombre: attachedUser.nombre || '',
        apellido: attachedUser.apellido || '',
        email: attachedUser.email || '',
        telefono: attachedUser.telefono || ''
      };

      // Validate products
      const rawProducts = body.products;
      const sanitizedItems = [];
      for (const item of rawProducts) {
        const rawId = item.productId || item.id || item._id;
        const productId = rawId ? String(rawId).trim() : '';
        if (!productId) {
          return res.status(400).json({ error: 'Each product must have productId' });
        }
        const quantity = Math.floor(toNumber(item.quantity ?? item.cantidad, 0));
        if (quantity <= 0) {
          return res.status(400).json({ error: `Invalid quantity for product ${productId}` });
        }
        sanitizedItems.push({ productId, quantity });
      }

      // Start transaction
      session = await mongoose.startSession();

      await session.withTransaction(async () => {
        const orderItems = [];
        let subtotal = 0;

        for (const item of sanitizedItems) {
          const product = await findProductByIdentifier(item.productId, session);
          if (!product) {
            const err = new Error(`Product not found: ${item.productId}`);
            err.status = 404;
            throw err;
          }

          const available = toNumber(product.stock, 0);
          if (available < item.quantity) {
            const err = new Error(`Insufficient stock for ${product.nombre || product._id}`);
            err.status = 400;
            throw err;
          }

          // Decrement stock
          product.stock = available - item.quantity;
          await product.save({ session });

          const basePrice = toNumber(product.precio, 0);
          const discountPct = toNumber(product.descuento, 0);
          const unitPrice = roundMoney(basePrice * (1 - discountPct / 100));
          const lineTotal = roundMoney(unitPrice * item.quantity);
          subtotal += lineTotal;

          orderItems.push({
            productId: product._id.toString(),
            id: product.id || '',
            nombre: product.nombre,
            categoria: product.categoria || 'otros',
            cantidad: item.quantity,
            unitPrice,
            lineTotal,
            subtotal: lineTotal
          });
        }

        const TAX_RATE = 0.15;
        const shippingSource = body.shipping || body.entrega || {};
        const shippingCost = roundMoney(toNumber(shippingSource.costo ?? shippingSource.cost ?? 3.5, 0));
        const discount = roundMoney(Math.max(0, toNumber(body.discount ?? 0, 0)));
        const taxes = roundMoney(subtotal * TAX_RATE);
        const total = roundMoney(Math.max(0, subtotal + taxes + shippingCost - discount));

        const totales = {
          subtotal: roundMoney(subtotal),
          iva: taxes,
          envio: shippingCost,
          discount,
          total
        };

        const paymentSource = body.payment || body.pago || {};
        const pago = {
          metodo: paymentSource.metodo || paymentSource.method || 'efectivo',
          estado: paymentSource.estado || 'pagado',
          referencia: paymentSource.referencia || paymentSource.reference || ''
        };

        const entrega = {
          direccion: shippingSource.direccion || shippingSource.address || '',
          referencias: shippingSource.referencias || '',
          contacto: shippingSource.contacto || ''
        };

        const resumen = {
          cliente,
          productos: orderItems,
          totales,
          entrega,
          pago
        };

        const order = new Order({
          userId: attachedUser._id,
          items: orderItems,
          resumen,
          estado: 'confirmado',
          fecha: new Date()
        });

        await order.save({ session });

        // Update user orders array
        const userForUpdate = await User.findById(attachedUser._id).session(session);
        if (userForUpdate) {
          userForUpdate.orders = userForUpdate.orders || [];
          userForUpdate.orders.push({
            orderId: order._id,
            codigo: order.id,
            fecha: order.fecha,
            resumen
          });
          userForUpdate.cart = [];
          await userForUpdate.save({ session });
        }

        createdOrder = order;
      });

      await session.endSession();
      session = null;
      console.log(`[POST /reports] Order created with id: ${createdOrder.id}`);
    }

    // Build fresh report from orders in database
    const reportData = await buildReportData();
    reportData.notas = notas;

    let savedReport = null;
    if (shouldSave) {
      savedReport = await new Report(reportData).save();
      console.log(`[POST /reports] Report saved with id: ${savedReport.id}`);
    }

    const response = {
      success: true,
      saved: shouldSave,
      report: {
        _id: savedReport ? savedReport._id : undefined,
        id: savedReport ? savedReport.id : undefined,
        generadoEn: reportData.generadoEn,
        periodoInicio: reportData.periodoInicio,
        periodoFin: reportData.periodoFin,
        totalVentas: reportData.totalVentas,
        totalOrdenes: reportData.totalOrdenes,
        totalProductosVendidos: reportData.totalProductosVendidos,
        ventasHoy: reportData.ventasHoy,
        ventasSemana: reportData.ventasSemana,
        ventasMes: reportData.ventasMes,
        ordenesHoy: reportData.ordenesHoy,
        ordenesSemana: reportData.ordenesSemana,
        ordenesMes: reportData.ordenesMes,
        topProductos: reportData.topProductos,
        ventasPorCategoria: reportData.ventasPorCategoria,
        notas: reportData.notas
      }
    };

    // Include order info if one was created
    if (createdOrder) {
      response.order = {
        _id: createdOrder._id,
        id: createdOrder.id,
        fecha: createdOrder.fecha,
        estado: createdOrder.estado,
        resumen: createdOrder.resumen
      };
    }

    res.status(createdOrder ? 201 : 200).json(response);
  } catch (err) {
    if (session) {
      try { await session.endSession(); } catch (e) { /* ignore */ }
    }
    console.error('POST /reports error:', err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Unable to generate report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /reports
// Returns latest report snapshot, or list of reports with optional filters.
// Query params: ?latest=true | ?from=ISO&to=ISO | ?limit=N
// ─────────────────────────────────────────────────────────────────────────────

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { latest, from, to, limit } = req.query;

    if (latest === 'true' || latest === '1') {
      // Return freshly computed snapshot (not saved)
      const data = await buildReportData();
      return res.json(data);
    }

    // Otherwise list saved reports
    const query = {};
    if (from || to) {
      query.generadoEn = {};
      if (from) query.generadoEn.$gte = new Date(from);
      if (to) query.generadoEn.$lte = new Date(to);
    }

    const maxLimit = Math.min(toNumber(limit, 20), 100);
    const reports = await Report.find(query).sort({ generadoEn: -1 }).limit(maxLimit).lean();
    res.json(reports);
  } catch (err) {
    console.error('GET /reports error:', err);
    res.status(500).json({ error: 'Unable to fetch reports' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: find report by _id or numeric id field
// ─────────────────────────────────────────────────────────────────────────────

async function findReportByIdentifier(identifier) {
  // Try by MongoDB _id first
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const byObjectId = await Report.findById(identifier).lean();
    if (byObjectId) return byObjectId;
  }
  // Try by numeric id field
  const byId = await Report.findOne({ id: String(identifier) }).lean();
  return byId || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /reports/:id
// Returns a specific saved report by _id or numeric id.
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await findReportByIdentifier(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (err) {
    console.error('GET /reports/:id error:', err);
    res.status(500).json({ error: 'Unable to fetch report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /reports/:id
// Updates a specific saved report by _id or numeric id.
// ─────────────────────────────────────────────────────────────────────────────

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await findReportByIdentifier(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const body = req.body || {};
    const updates = {};

    if (body.notas !== undefined) updates.notas = String(body.notas || '');
    if (body.tipo !== undefined) updates.tipo = String(body.tipo || 'snapshot');

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }

    const updated = await Report.findByIdAndUpdate(
      report._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    res.json(updated);
  } catch (err) {
    console.error('PUT /reports/:id error:', err);
    res.status(500).json({ error: 'Unable to update report' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /reports/:id
// Deletes a specific saved report by _id or numeric id.
// ─────────────────────────────────────────────────────────────────────────────

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await findReportByIdentifier(id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    await Report.findByIdAndDelete(report._id);
    res.json({ success: true, deleted: report._id });
  } catch (err) {
    console.error('DELETE /reports/:id error:', err);
    res.status(500).json({ error: 'Unable to delete report' });
  }
});

module.exports = router;
