const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  photo: { type: String },
  telefono: { type: String },
  cedula: { type: String },
  isAdmin: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  cart: { type: Array, default: [] },
  orders: { type: Array, default: [] },
  fechaCreacion: { type: Date, default: Date.now }
});

userSchema.set('toJSON', { versionKey: false });

module.exports = mongoose.model('User', userSchema);
