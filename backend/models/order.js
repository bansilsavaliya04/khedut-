const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  productName: { type: String, required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  farmerName: { type: String, required: true },
  unit: { type: String, default: 'kg' },
  quantity: { type: Number, required: true, min: 0.01 },
  pricePerUnit: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  message: { type: String, default: '', maxlength: 500 },
  stockReserved: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'delivered'],
    default: 'pending',
    index: true
  },
  acceptedAt: Date,
  rejectedAt: Date,
  cancelledAt: Date,
  deliveredAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
