const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: { type: Array, default: [] },
  resumen: { type: Object, default: {} },
  estado: { type: String, default: 'pendiente' },
  fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
