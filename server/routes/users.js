const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {authMiddleware } = require('../middleware/auth');

// GET /api/users/me - return current authenticated user (no passwordHash)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(userId).select('-passwordHash -emailVerificationToken -emailVerificationExpires');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error fetching /me user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/me - update allowed profile fields for the authenticated user
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const allowed = ['nombre', 'apellido', 'telefono', 'cedula', 'photo'];
    const updates = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        const v = req.body[key] === null || req.body[key] === undefined ? '' : String(req.body[key]).trim();
        updates[key] = v;
      }
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true }).select('-passwordHash -emailVerificationToken -emailVerificationExpires');
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating /me user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users - list users (no passwords)
router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ nombre: 1 }).lean();
    res.json(users);
  } catch (err) {
    console.error('Error listing users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id - update user
router.put('/:id', async (req, res) => {
  try {
    const update = { ...req.body, fechaModificacion: new Date() };
    // disallow passwordHash update here for safety
    delete update.passwordHash;
    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(400).json({ error: 'Invalid update' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
