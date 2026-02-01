require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('./config/passport');
const { verifyTransporter } = require('./utils/email');

const app = express();
app.use(morgan('tiny'));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.set('trust proxy', true);

// Database connection helper
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/markettatylu';
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
    }
  }
}
connectWithRetry(MONGODB_URI);

// Session (used by Google OAuth local flow if enabled)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI || MONGODB_URI, touchAfter: 24 * 3600 }),
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true }
  })
);

// Passport
app.use(passport.initialize());
app.use(passport.session());

// Mount routes
app.use('/api/products', require('./routes/products'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/categories', require('./routes/categories'));
app.use('/', require('./routes/public'));

// Health endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'backend-crud' }));

// Seed default products and admin user (dev convenience)
const Product = require('./models/Product');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

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

async function seedAdminUser() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toString().trim().toLowerCase();
    const adminPass = (process.env.ADMIN_PASS || '123456').toString();

    let user = await User.findOne({ email: adminEmail });
    if (user) {
      user.isAdmin = true;
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

mongoose.connection.once('connected', () => {
  seedDefaultProducts().catch(err => console.error('seedDefaultProducts error:', err));
  seedAdminUser().catch(err => console.error('seedAdminUser error:', err));

  // Verify email transporter
  (async () => {
    try {
      const r = await verifyTransporter();
      if (!r.ok) console.warn('Email transporter not verified; configure SMTP env vars for production');
    } catch (err) {
      console.error('verifyTransporter error:', err);
    }
  })();
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✓ backend-crud running on port ${PORT}`));
