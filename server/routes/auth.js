const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { nombre, apellido, email, password, cedula, telefono, photo } = req.body;
    if (!email || !password || !nombre) return res.status(400).json({ error: 'Missing fields' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({ nombre, apellido, email, passwordHash, cedula, telefono, photo });
    const saved = await user.save();

    // Issue token at registration so client can be logged in immediately
    const token = jwt.sign({ id: saved._id, email: saved.email }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: saved._id, nombre: saved.nombre, email: saved.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });

    res.json({ token, user: { id: user._id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
