const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  rating: { type: Number, default: 5 },
  title: { type: String, default: '' },
  body: { type: String, required: true },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);
