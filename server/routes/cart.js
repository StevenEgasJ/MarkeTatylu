const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Product = require('../models/Product');
const { authMiddleware } = require('../middleware/auth');

// NOTE: Auth removed intentionally for cart APIs to allow microservice-style usage
// Business rules configuration
const BUSINESS_RULES = {
  MIN_ORDER_AMOUNT: Number(process.env.MIN_ORDER_AMOUNT) || 0,
  MAX_ITEMS_PER_PRODUCT: Number(process.env.MAX_ITEMS_PER_PRODUCT) || 99,
  FREE_SHIPPING_THRESHOLD: Number(process.env.FREE_SHIPPING_THRESHOLD) || 50000,
  SHIPPING_COST: Number(process.env.SHIPPING_COST) || 5000,
  LOYALTY_DISCOUNT_PERCENT: Number(process.env.LOYALTY_DISCOUNT_PERCENT) || 5,
  BULK_DISCOUNT_THRESHOLD: Number(process.env.BULK_DISCOUNT_THRESHOLD) || 5,
  BULK_DISCOUNT_PERCENT: Number(process.env.BULK_DISCOUNT_PERCENT) || 10
};

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

// Helper: calculate cart totals with business rules
function calculateCartTotals(items, options = {}) {
  const { applyLoyaltyDiscount = false, applyBulkDiscount = true } = options;
  
  let subtotal = 0;
  let totalDiscount = 0;
  let itemCount = 0;

  const computedItems = items.map(item => {
    const qty = Number(item.cantidad || item.quantity || 0);
    const unitPrice = Number(item.precio || item.price || 0);
    const productDiscount = Number(item.descuento || item.discount || 0);
    const nombre = item.nombre || item.name || '';

    // Apply product discount
    const priceAfterProductDiscount = +(unitPrice * (1 - productDiscount / 100));
    
    // Check for bulk discount (if quantity exceeds threshold)
    let bulkDiscount = 0;
    if (applyBulkDiscount && qty >= BUSINESS_RULES.BULK_DISCOUNT_THRESHOLD) {
      bulkDiscount = BUSINESS_RULES.BULK_DISCOUNT_PERCENT;
    }
    
    const priceAfterAllDiscounts = +(priceAfterProductDiscount * (1 - bulkDiscount / 100));
    const lineTotal = +(priceAfterAllDiscounts * qty);
    
    subtotal += lineTotal;
    totalDiscount += +((unitPrice - priceAfterAllDiscounts) * qty);
    itemCount += qty;

    return {
      productId: item.productId || item.id,
      nombre,
      unitPrice: +unitPrice.toFixed(2),
      productDiscount: +productDiscount.toFixed(2),
      bulkDiscount: +bulkDiscount.toFixed(2),
      priceAfterDiscount: +priceAfterAllDiscounts.toFixed(2),
      cantidad: qty,
      lineTotal: +lineTotal.toFixed(2)
    };
  });

  // Apply loyalty discount if applicable
  let loyaltyDiscount = 0;
  if (applyLoyaltyDiscount) {
    loyaltyDiscount = +(subtotal * (BUSINESS_RULES.LOYALTY_DISCOUNT_PERCENT / 100));
    subtotal = +(subtotal - loyaltyDiscount);
    totalDiscount += loyaltyDiscount;
  }

  // Calculate shipping
  const shippingCost = subtotal >= BUSINESS_RULES.FREE_SHIPPING_THRESHOLD ? 0 : BUSINESS_RULES.SHIPPING_COST;
  const total = +(subtotal + shippingCost).toFixed(2);

  return {
    items: computedItems,
    subtotal: +subtotal.toFixed(2),
    totalDiscount: +totalDiscount.toFixed(2),
    loyaltyDiscount: +loyaltyDiscount.toFixed(2),
    shippingCost: +shippingCost.toFixed(2),
    freeShippingThreshold: BUSINESS_RULES.FREE_SHIPPING_THRESHOLD,
    amountToFreeShipping: subtotal >= BUSINESS_RULES.FREE_SHIPPING_THRESHOLD 
      ? 0 
      : +(BUSINESS_RULES.FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2),
    itemCount,
    total
  };
}

// Small fetch helper that falls back to node-fetch when running on older Node versions
const doFetch = (...args) => {
  if (global.fetch) return global.fetch(...args);
  try {
    return require('node-fetch')(...args);
  } catch (err) {
    throw new Error('Fetch is not available and node-fetch is not installed. Please run on Node >=18 or install node-fetch.');
  }
};

// =====================================================
// BASIC CART ENDPOINTS
// =====================================================

// GET /api/cart - get current user's cart
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('cart');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ cart: user.cart || [] });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart - replace user's cart
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { cart } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.cart = Array.isArray(cart) ? cart : [];
    await user.save();
    res.json({ cart: user.cart });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// =====================================================
// MICROSERVICE-STYLE BUSINESS RULES ENDPOINTS
// =====================================================

// POST /api/cart/calculate - calculate cart totals with business rules
// Accepts cart items and returns calculated totals with discounts
router.post('/calculate', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // Fetch product info for items that provide productId
    const productIds = Array.from(new Set(items.filter(i => i.productId).map(i => i.productId)));
    const prodMap = productIds.length ? await resolveProductsByIdentifiers(productIds) : new Map();

    // Enrich items with product data
    const enrichedItems = items.map(item => {
      const lookupKey = item.productId ? String(item.productId) : null;
      if (lookupKey && prodMap.has(lookupKey)) {
        const product = prodMap.get(lookupKey);
        return {
          ...item,
          productId: item.productId,
          nombre: item.nombre || product.nombre,
          precio: product.precio,
          descuento: Number(product.descuento || 0),
          stock: product.stock,
          categoria: product.categoria
        };
      }
      return item;
    });

    const applyLoyaltyDiscount = req.body.applyLoyaltyDiscount === true;
    const applyBulkDiscount = req.body.applyBulkDiscount !== false;

    const summary = calculateCartTotals(enrichedItems, { applyLoyaltyDiscount, applyBulkDiscount });

    res.json({ 
      success: true,
      summary,
      businessRules: BUSINESS_RULES
    });
  } catch (err) {
    console.error('Error calculating cart:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart/validate - validate cart items (stock, availability, limits)
router.post('/validate', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    const productIds = Array.from(new Set(items.filter(i => i.productId).map(i => i.productId)));
    const prodMap = productIds.length ? await resolveProductsByIdentifiers(productIds) : new Map();

    const validationResults = [];
    let isValid = true;

    for (const item of items) {
      const lookupKey = item.productId ? String(item.productId) : null;
      const qty = Number(item.cantidad || item.quantity || 0);
      const itemResult = {
        productId: item.productId,
        nombre: item.nombre || item.name,
        requestedQuantity: qty,
        errors: [],
        warnings: []
      };

      // Check if product exists
      if (!lookupKey || !prodMap.has(lookupKey)) {
        itemResult.errors.push('Product not found');
        itemResult.isValid = false;
        isValid = false;
        validationResults.push(itemResult);
        continue;
      }

      const product = prodMap.get(lookupKey);
      itemResult.nombre = product.nombre;
      itemResult.availableStock = product.stock;
      itemResult.unitPrice = product.precio;

      // Check quantity limits
      if (qty <= 0) {
        itemResult.errors.push('Quantity must be greater than 0');
        isValid = false;
      }

      if (qty > BUSINESS_RULES.MAX_ITEMS_PER_PRODUCT) {
        itemResult.errors.push(`Maximum ${BUSINESS_RULES.MAX_ITEMS_PER_PRODUCT} items per product allowed`);
        isValid = false;
      }

      // Check stock availability
      if (product.stock !== undefined && product.stock !== null) {
        if (product.stock === 0) {
          itemResult.errors.push('Product out of stock');
          isValid = false;
        } else if (qty > product.stock) {
          itemResult.errors.push(`Insufficient stock. Available: ${product.stock}`);
          itemResult.suggestedQuantity = product.stock;
          isValid = false;
        } else if (qty > product.stock * 0.8) {
          itemResult.warnings.push('Low stock warning');
        }
      }

      itemResult.isValid = itemResult.errors.length === 0;
      validationResults.push(itemResult);
    }

    res.json({
      isValid,
      items: validationResults,
      totalItems: items.length,
      validItems: validationResults.filter(r => r.isValid).length,
      invalidItems: validationResults.filter(r => !r.isValid).length
    });
  } catch (err) {
    console.error('Error validating cart:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart/apply-promotions - apply promotions and calculate savings
router.post('/apply-promotions', async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const promoCode = (req.body.promoCode || '').trim().toUpperCase();
    
    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // Fetch product info
    const productIds = Array.from(new Set(items.filter(i => i.productId).map(i => i.productId)));
    const prodMap = productIds.length ? await resolveProductsByIdentifiers(productIds) : new Map();

    // Enrich items with product data
    const enrichedItems = items.map(item => {
      const lookupKey = item.productId ? String(item.productId) : null;
      if (lookupKey && prodMap.has(lookupKey)) {
        const product = prodMap.get(lookupKey);
        return {
          ...item,
          nombre: product.nombre,
          precio: product.precio,
          descuento: Number(product.descuento || 0),
          categoria: product.categoria
        };
      }
      return item;
    });

    // Define available promotions (can be extended to use database)
    const promotions = {
      'WELCOME10': { type: 'percentage', value: 10, description: '10% off for new customers' },
      'SAVE20': { type: 'percentage', value: 20, description: '20% off entire order' },
      'FLAT5000': { type: 'fixed', value: 5000, description: '$5000 off your order' },
      'FREESHIP': { type: 'freeShipping', value: 0, description: 'Free shipping on your order' }
    };

    let promoApplied = null;
    let promoDiscount = 0;
    let promoError = null;

    // Calculate base totals first
    let baseSummary = calculateCartTotals(enrichedItems, { applyLoyaltyDiscount: false });

    // Apply promo code if provided
    if (promoCode) {
      if (promotions[promoCode]) {
        const promo = promotions[promoCode];
        promoApplied = { code: promoCode, ...promo };

        switch (promo.type) {
          case 'percentage':
            promoDiscount = +(baseSummary.subtotal * (promo.value / 100)).toFixed(2);
            break;
          case 'fixed':
            promoDiscount = Math.min(promo.value, baseSummary.subtotal);
            break;
          case 'freeShipping':
            promoDiscount = baseSummary.shippingCost;
            break;
        }
      } else {
        promoError = 'Invalid promo code';
      }
    }

    // Calculate savings breakdown
    const productDiscountSavings = enrichedItems.reduce((sum, item) => {
      const qty = Number(item.cantidad || item.quantity || 0);
      const unitPrice = Number(item.precio || 0);
      const discount = Number(item.descuento || 0);
      return sum + (unitPrice * (discount / 100) * qty);
    }, 0);

    const bulkDiscountSavings = baseSummary.items.reduce((sum, item) => {
      if (item.bulkDiscount > 0) {
        const beforeBulk = item.unitPrice * (1 - item.productDiscount / 100);
        return sum + (beforeBulk * (item.bulkDiscount / 100) * item.cantidad);
      }
      return sum;
    }, 0);

    const shippingSavings = baseSummary.shippingCost === 0 ? BUSINESS_RULES.SHIPPING_COST : 0;

    const totalSavings = +(productDiscountSavings + bulkDiscountSavings + promoDiscount + shippingSavings).toFixed(2);
    const finalTotal = +(baseSummary.total - promoDiscount).toFixed(2);

    res.json({
      success: true,
      originalTotal: +(baseSummary.subtotal + BUSINESS_RULES.SHIPPING_COST).toFixed(2),
      finalTotal: Math.max(0, finalTotal),
      savings: {
        productDiscounts: +productDiscountSavings.toFixed(2),
        bulkDiscounts: +bulkDiscountSavings.toFixed(2),
        promoCodeDiscount: +promoDiscount.toFixed(2),
        freeShipping: +shippingSavings.toFixed(2),
        total: totalSavings
      },
      promotion: promoApplied,
      promoError,
      summary: {
        ...baseSummary,
        promoDiscount: +promoDiscount.toFixed(2),
        finalTotal: Math.max(0, finalTotal)
      },
      availablePromoCodes: Object.keys(promotions)
    });
  } catch (err) {
    console.error('Error applying promotions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/cart/summary/:userId - get full cart summary for a user
router.get('/summary/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('cart nombre email').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const items = user.cart || [];
    if (!items.length) {
      return res.json({
        user: { id: user._id, nombre: user.nombre, email: user.email },
        isEmpty: true,
        items: [],
        summary: null
      });
    }

    // Fetch product info
    const productIds = Array.from(new Set(items.filter(i => i.productId || i.id).map(i => i.productId || i.id)));
    const prodMap = productIds.length ? await resolveProductsByIdentifiers(productIds) : new Map();

    // Enrich items
    const enrichedItems = items.map(item => {
      const lookupKey = (item.productId || item.id) ? String(item.productId || item.id) : null;
      if (lookupKey && prodMap.has(lookupKey)) {
        const product = prodMap.get(lookupKey);
        return {
          productId: item.productId || item.id,
          nombre: product.nombre,
          precio: product.precio,
          descuento: Number(product.descuento || 0),
          cantidad: Number(item.cantidad || item.quantity || 1),
          imagen: product.imagen,
          categoria: product.categoria,
          stock: product.stock
        };
      }
      return item;
    });

    const summary = calculateCartTotals(enrichedItems, { applyLoyaltyDiscount: false });

    res.json({
      user: { id: user._id, nombre: user.nombre, email: user.email },
      isEmpty: false,
      items: enrichedItems,
      summary
    });
  } catch (err) {
    console.error('Error fetching cart summary:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart/microservice-checkout - full checkout preparation (validate + calculate + prepare)
// Demonstrates an API that calls other cart APIs internally
router.post('/microservice-checkout', async (req, res) => {
  try {
    const port = process.env.PORT || 4000;
    const baseUrl = `http://localhost:${port}`;
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const promoCode = req.body.promoCode || '';
    const userId = req.body.userId;

    if (!items.length) return res.status(400).json({ error: 'No items provided' });

    // Step 1: Validate cart items
    const validateResp = await doFetch(`${baseUrl}/cart/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!validateResp.ok) {
      const txt = await validateResp.text();
      return res.status(502).json({ error: 'Validation service failed', details: txt });
    }

    const validation = await validateResp.json();

    // If validation fails, return errors
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        step: 'validation',
        message: 'Cart validation failed',
        validation
      });
    }

    // Step 2: Apply promotions and calculate totals
    const promoResp = await doFetch(`${baseUrl}/cart/apply-promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, promoCode })
    });

    if (!promoResp.ok) {
      const txt = await promoResp.text();
      return res.status(502).json({ error: 'Promotions service failed', details: txt });
    }

    const promotionResult = await promoResp.json();

    // Step 3: Final calculation
    const calcResp = await doFetch(`${baseUrl}/cart/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        items, 
        applyLoyaltyDiscount: req.body.applyLoyaltyDiscount || false,
        applyBulkDiscount: req.body.applyBulkDiscount !== false
      })
    });

    if (!calcResp.ok) {
      const txt = await calcResp.text();
      return res.status(502).json({ error: 'Calculation service failed', details: txt });
    }

    const calculation = await calcResp.json();

    // Prepare checkout data
    const checkoutData = {
      success: true,
      userId,
      timestamp: new Date().toISOString(),
      validation: {
        isValid: validation.isValid,
        itemCount: validation.totalItems
      },
      pricing: {
        subtotal: calculation.summary.subtotal,
        discounts: calculation.summary.totalDiscount,
        shipping: calculation.summary.shippingCost,
        promoDiscount: promotionResult.savings.promoCodeDiscount,
        total: +(calculation.summary.total - promotionResult.savings.promoCodeDiscount).toFixed(2)
      },
      promotion: promotionResult.promotion,
      savings: promotionResult.savings,
      items: calculation.summary.items,
      readyForPayment: true,
      via: ['validate', 'apply-promotions', 'calculate']
    };

    // Check minimum order amount
    if (checkoutData.pricing.total < BUSINESS_RULES.MIN_ORDER_AMOUNT) {
      checkoutData.readyForPayment = false;
      checkoutData.error = `Minimum order amount is ${BUSINESS_RULES.MIN_ORDER_AMOUNT}`;
    }

    res.json(checkoutData);
  } catch (err) {
    console.error('Error in microservice-checkout:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/cart/quick-add - add product to cart with validation
router.post('/quick-add', async (req, res) => {
  try {
    const { userId, productId, cantidad = 1 } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    // Find product
    const prodMap = await resolveProductsByIdentifiers([productId]);
    const product = prodMap.get(String(productId));

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Validate stock
    if (product.stock !== undefined && product.stock < cantidad) {
      return res.status(400).json({ 
        error: 'Insufficient stock',
        available: product.stock,
        requested: cantidad
      });
    }

    // Find user and update cart
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.cart) user.cart = [];

    // Check if product already in cart
    const existingIndex = user.cart.findIndex(item => 
      String(item.productId || item.id) === String(productId)
    );

    if (existingIndex >= 0) {
      const newQty = (user.cart[existingIndex].cantidad || 0) + cantidad;
      
      // Validate total quantity against limits
      if (newQty > BUSINESS_RULES.MAX_ITEMS_PER_PRODUCT) {
        return res.status(400).json({
          error: `Maximum ${BUSINESS_RULES.MAX_ITEMS_PER_PRODUCT} items per product allowed`,
          currentQuantity: user.cart[existingIndex].cantidad
        });
      }

      user.cart[existingIndex].cantidad = newQty;
    } else {
      user.cart.push({
        productId: product._id.toString(),
        nombre: product.nombre,
        precio: product.precio,
        descuento: product.descuento || 0,
        imagen: product.imagen,
        cantidad
      });
    }

    await user.save();

    // Return updated cart summary
    const summary = calculateCartTotals(user.cart);

    res.json({
      success: true,
      message: existingIndex >= 0 ? 'Product quantity updated' : 'Product added to cart',
      cart: user.cart,
      summary
    });
  } catch (err) {
    console.error('Error in quick-add:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/cart/clear/:userId - clear user's cart
router.delete('/clear/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const itemsCleared = (user.cart || []).length;
    user.cart = [];
    await user.save();

    res.json({
      success: true,
      message: 'Cart cleared',
      itemsCleared
    });
  } catch (err) {
    console.error('Error clearing cart:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/cart/business-rules - get current business rules configuration
router.get('/business-rules', (req, res) => {
  res.json({
    rules: BUSINESS_RULES,
    description: {
      MIN_ORDER_AMOUNT: 'Minimum order amount to proceed with checkout',
      MAX_ITEMS_PER_PRODUCT: 'Maximum quantity allowed per product',
      FREE_SHIPPING_THRESHOLD: 'Order subtotal threshold for free shipping',
      SHIPPING_COST: 'Standard shipping cost when below free shipping threshold',
      LOYALTY_DISCOUNT_PERCENT: 'Discount percentage for loyalty program members',
      BULK_DISCOUNT_THRESHOLD: 'Minimum quantity per product to trigger bulk discount',
      BULK_DISCOUNT_PERCENT: 'Discount percentage for bulk purchases'
    }
  });
});

module.exports = router;
