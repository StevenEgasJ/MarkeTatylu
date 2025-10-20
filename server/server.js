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
const Product = require('./models/Product');

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
app.use('/api', adminRouter);
app.use('/api/checkout', checkoutRouter);

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
