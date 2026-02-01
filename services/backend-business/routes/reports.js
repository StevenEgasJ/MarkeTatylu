const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Report = require('../models/Report');

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
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

async function buildReportData() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const orders = await Order.find({}).lean();
  console.log(`[buildReportData] Found ${orders.length} orders in database`);

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

  const productSales = {};
  const categoryRevenue = {};

  for (const order of orders) {
    const orderDate = new Date(order.fecha || order.createdAt || 0);
    const orderTotal = toNumber(order.resumen?.totales?.total ?? order.totales?.total ?? 0, 0);

    totalVentas += orderTotal;

    const isToday = orderDate >= todayStart;
    const isThisWeek = orderDate >= weekStart;
    const isThisMonth = orderDate >= monthStart;

    if (isToday) { ventasHoy += orderTotal; ordenesHoy += 1; }
    if (isThisWeek) { ventasSemana += orderTotal; ordenesSemana += 1; }
    if (isThisMonth) { ventasMes += orderTotal; ordenesMes += 1; }

    const items = order.resumen?.productos || order.productos || order.items || [];
    for (const item of items) {
      const pid = String(item.productId || item.id || item._id || 'unknown');
      const qty = toNumber(item.cantidad || item.quantity, 0);
      const productInfo = productMap.get(pid) || {};
      let unitPrice = toNumber(item.precio || item.unitPrice || item.price, 0);
      if (unitPrice === 0 && productInfo.precio) unitPrice = toNumber(productInfo.precio, 0);
      let lineRevenue = toNumber(item.subtotal || item.lineTotal, 0);
      if (lineRevenue === 0 && unitPrice > 0) lineRevenue = roundMoney(unitPrice * qty);
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

  const ventasPorCategoria = {};
  for (const cat of Object.keys(categoryRevenue)) ventasPorCategoria[cat] = roundMoney(categoryRevenue[cat]);

  return {
    tipo: 'snapshot', generadoEn: now, periodoInicio: monthStart, periodoFin: now, totalVentas: roundMoney(totalVentas), totalOrdenes, totalProductosVendidos, ventasHoy: roundMoney(ventasHoy), ventasSemana: roundMoney(ventasSemana), ventasMes: roundMoney(ventasMes), ordenesHoy, ordenesSemana, ordenesMes, topProductos, ventasPorCategoria
  };
}

async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  const idNum = parseInt(idStr, 10);
  console.log(`[findUserByIdentifier] Searching for: "${idStr}", as number: ${idNum}`);
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) { const byObjectId = await User.findById(idStr); if (byObjectId) { console.log(`[findUserByIdentifier] Found by _id`); return byObjectId; } }
  const orConditions = [{ id: idStr }]; if (!isNaN(idNum)) { orConditions.push({ id: idNum }); } orConditions.push({ email: idStr });
  const user = await User.findOne({ $or: orConditions }); if (user) { console.log(`[findUserByIdentifier] Found user: ${user.email}`); return user; }
  const allUsers = await User.find({}, { id: 1, email: 1, _id: 1 }).limit(10).lean();
  console.log(`[findUserByIdentifier] Not found. Sample users in DB:`, JSON.stringify(allUsers));
  return null;
}

async function findProductByIdentifier(identifier, session = null) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) { const query = Product.findById(idStr); if (session) query.session(session); const byObjectId = await query; if (byObjectId) return byObjectId; }
  let query = Product.findOne({ id: idStr }); if (session) query.session(session); const byIdStr = await query; if (byIdStr) return byIdStr; query = Product.findOne({ id: Number(idStr) }); if (session) query.session(session); return await query;
}

router.post('/', authMiddleware, async (req, res) => {
  let session = null;
  try {
    const body = req.body || {};
    const shouldSave = body.save !== false && body.save !== 'false';
    const notas = body.notas || body.notes || '';

    let createdOrder = null;

    if (body.userId && body.products && Array.isArray(body.products) && body.products.length > 0) {
      const attachedUser = await findUserByIdentifier(body.userId);
      if (!attachedUser) { return res.status(404).json({ error: `User not found: ${body.userId}` }); }

      const cliente = { id: attachedUser._id.toString(), odooId: attachedUser.id || '', nombre: attachedUser.nombre || '', apellido: attachedUser.apellido || '', email: attachedUser.email || '', telefono: attachedUser.telefono || '' };

      const rawProducts = body.products;
      const sanitizedItems = [];
      for (const item of rawProducts) {
        const rawId = item.productId || item.id || item._id;
        const productId = rawId ? String(rawId).trim() : '';
        if (!productId) { return res.status(400).json({ error: 'Each product must have productId' }); }
        const quantity = Math.floor(toNumber(item.quantity ?? item.cantidad, 0));
        if (quantity <= 0) { return res.status(400).json({ error: `Invalid quantity for product ${productId}` }); }
        sanitizedItems.push({ productId, quantity });
      }

      session = await mongoose.startSession();

      await session.withTransaction(async () => {
        const orderItems = [];
        let subtotal = 0;

        for (const item of sanitizedItems) {
          const product = await findProductByIdentifier(item.productId, session);
          if (!product) { const err = new Error(`Product not found: ${item.productId}`); err.status = 404; throw err; }
          const available = toNumber(product.stock, 0);
          if (available < item.quantity) { const err = new Error(`Insufficient stock for ${product.nombre || product._id}`); err.status = 400; throw err; }
          product.stock = available - item.quantity; await product.save({ session });
          const basePrice = toNumber(product.precio, 0);
          const discountPct = toNumber(product.descuento, 0);
          const unitPrice = roundMoney(basePrice * (1 - discountPct / 100));
          const lineTotal = roundMoney(unitPrice * item.quantity);
          subtotal += lineTotal;

          orderItems.push({ productId: product._id.toString(), id: product.id || '', nombre: product.nombre, categoria: product.categoria || 'otros', cantidad: item.quantity, unitPrice, lineTotal, subtotal: lineTotal });
        }

        const TAX_RATE = 0.15;
        const shippingSource = body.shipping || body.entrega || {};
        const shippingCost = roundMoney(toNumber(shippingSource.costo ?? shippingSource.cost ?? 3.5, 0));
        const discount = roundMoney(Math.max(0, toNumber(body.discount ?? 0, 0)));
        const taxes = roundMoney(subtotal * TAX_RATE);
        const total = roundMoney(Math.max(0, subtotal + taxes + shippingCost - discount));

        const totales = { subtotal: roundMoney(subtotal), iva: taxes, envio: shippingCost, discount, total };

        const paymentSource = body.payment || body.pago || {};
        const pago = { metodo: paymentSource.metodo || paymentSource.method || 'efectivo', estado: paymentSource.estado || 'pagado', referencia: paymentSource.referencia || paymentSource.reference || '' };

        const entrega = { direccion: shippingSource.direccion || shippingSource.address || '', referencias: shippingSource.referencias || '', contacto: shippingSource.contacto || '' };

        const resumen = { cliente, productos: orderItems, totales, entrega, pago };

        const order = new Order({ userId: attachedUser._id, items: orderItems, resumen, estado: 'confirmado', fecha: new Date() });

        await order.save({ session });

        const userForUpdate = await User.findById(attachedUser._id).session(session);
        if (userForUpdate) {
          userForUpdate.orders = userForUpdate.orders || [];
          userForUpdate.orders.push({ orderId: order._id, codigo: order.id, fecha: order.fecha, resumen });
          userForUpdate.cart = [];
          await userForUpdate.save({ session });
        }
      });
    }

    const reportData = await buildReportData();

    if (shouldSave) {
      const r = new Report({ type: 'snapshot', payload: reportData });
      await r.save();
    }

    res.json({ success: true, report: reportData });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(err.status || 500).json({ error: err.message || 'Report generation failed' });
  } finally {
    if (session) { try { await session.endSession(); } catch (e) { console.warn('Could not end session:', e); } }
  }
});

module.exports = router;