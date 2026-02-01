const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: { type: String },
  payload: { type: Object },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
