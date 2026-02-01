const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  precio: { type: Number, required: true, default: 0 },
  categoria: { type: String, default: 'electrodomesticos' },
  stock: { type: Number, default: 0 },
  descuento: { type: Number, default: 0 },
  imagen: { type: String },
  descripcion: { type: String },
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date }
});

productSchema.virtual('id').get(function() { return this._id ? this._id.toString() : undefined; });
productSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('Product', productSchema);
