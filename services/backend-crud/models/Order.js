const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  id: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: { type: Array, default: [] },
  resumen: { type: Object, default: {} },
  estado: { type: String, default: 'confirmado' },
  fecha: { type: Date, default: Date.now }
});

orderSchema.set('toJSON', { versionKey: false });

module.exports = mongoose.model('Order', orderSchema);
