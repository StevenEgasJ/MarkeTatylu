require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const productsRouter = require('./routes/products');
const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const adminRouter = require('./routes/admin');
const checkoutRouter = require('./routes/checkout');
const invoicesRouter = require('./routes/invoices');
const debugRouter = require('./routes/debug');
const ordersRouter = require('./routes/orders');
const usersRouter = require('./routes/users');
const reviewsRouter = require('./routes/reviews');
const categoriesRouter = require('./routes/categories');
const publicRouter = require('./routes/public');
const Product = require('./models/Product');
const User = require('./models/User');
const suppliersRouter = require('./models/Supplier');

const bcrypt = require('bcryptjs');

const app = express();

// Configure CORS to accept origins from env or allow all for now
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools or same-origin
    if (allowedOrigins.includes('*') || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// Trust proxy when deployed behind load balancers (useful on platforms like Render)
app.set('trust proxy', true);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/el-valle';

// Mongoose connection with basic retry logic and improved logs
async function connectWithRetry(uri, attempts = 0) {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error(`❌ MongoDB connection error (attempt ${attempts + 1}):`, err.message || err);
    if (attempts < 5) {
      const delay = 2000 * (attempts + 1);
      console.log(`Retrying connection in ${delay}ms...`);
      setTimeout(() => connectWithRetry(uri, attempts + 1), delay);
    } else {
      console.error('Exceeded max MongoDB connection attempts');
    }
  }
}

connectWithRetry(MONGODB_URI);

mongoose.connection.on('connected', () => console.log('Mongoose connected event fired'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error event:', err));
mongoose.connection.on('disconnected', () => console.warn('Mongoose disconnected'));

// API routes
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
// Mount admin routes under /api/admin to match frontend expectations
app.use('/api/admin', adminRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/invoice', invoicesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/users', usersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/suppliers', suppliersRouter);

// Debug routes (only enabled when DEBUG_API=true in env)
app.use('/api/debug', debugRouter);

// Public read-only endpoints (no /api prefix)
app.use('/', publicRouter);

// Serve frontend static files (parent folder of server/)
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath));

// Simple health endpoint for deployment platforms and load balancers
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback to index.html for SPA-like behavior
app.get('*', (req, res, next) => {
  // Only fallback for browser requests (not /api/*)
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down');
  mongoose.disconnect().finally(() => process.exit(0));
});

// Seed default products if empty
async function seedDefaultProducts() {
  try {
    const count = await Product.countDocuments();
    if (count === 0) {
      console.log('Seeding default products...');
      const defaultProducts = [
        { nombre: 'Refrigeradora Samsung RF28T5001SR', precio: 1299.99, categoria: 'refrigeracion', stock: 15, imagen: './static/img/refrigeradora.png', descripcion: 'Refrigeradora de 28 pies cúbicos con tecnología Twin Cooling Plus' },
        { nombre: 'Microondas LG MS2596OB', precio: 189.99, categoria: 'cocina', stock: 25, imagen: './static/img/microondas.png', descripcion: 'Microondas de 25 litros con grill y función auto-cook' },
        { nombre: 'Licuadora Oster BLSTPB-WBL', precio: 89.99, categoria: 'pequenos', stock: 30, imagen: './static/img/licuadora.png', descripcion: 'Licuadora de 6 velocidades con jarra de vidrio' }
      ];
      await Product.insertMany(defaultProducts);
      console.log('✅ Default products seeded');
    }
  } catch (err) {
    console.error('Error seeding products:', err);
  }
}

seedDefaultProducts();

// Seed or promote an admin user on startup (development convenience).
// Credentials can be overridden with ADMIN_EMAIL and ADMIN_PASS env vars.
async function seedAdminUser() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toString().trim().toLowerCase();
    const adminPass = (process.env.ADMIN_PASS || '123456').toString();

    let user = await User.findOne({ email: adminEmail });
    if (user) {
      user.isAdmin = true;
      // Overwrite password to ensure known credentials for testing/dev
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(adminPass, salt);
      await user.save();
      console.log('✅ Admin user promoted/updated:', adminEmail);
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPass, salt);
      const newUser = new User({ nombre: 'Administrador', apellido: '', email: adminEmail, passwordHash, isAdmin: true });
      await newUser.save();
      console.log('✅ Admin user created:', adminEmail);
    }
  } catch (err) {
    console.error('Error seeding admin user:', err);
  }
}

// Only seed admin after DB connection is established
mongoose.connection.once('connected', () => {
  // Run asynchronously, don't block server startup
  seedAdminUser().catch(err => console.error('seedAdminUser error:', err));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Verify email transporter on startup and log helpful guidance
;(async () => {
  try {
    const { verifyTransporter } = require('./utils/email');
    const r = await verifyTransporter();
    if (!r.ok) {
      console.warn('Email transporter verification failed. If you expect to send real emails, configure SMTP env vars (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS).');
      console.warn('Server is currently configured to use Ethereal or has invalid SMTP settings. Emails may not reach real Gmail accounts.');
    }
  } catch (err) {
    console.error('Could not verify email transporter at startup:', err);
  }
})();
