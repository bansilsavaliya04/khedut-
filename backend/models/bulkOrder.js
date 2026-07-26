const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
  farmerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmerName: {
    type: String,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  pricePerUnit: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'delivered', 'cancelled'],
    default: 'pending'
  },
  stockReserved: {
    type: Boolean,
    default: true
  },
  acceptedAt: Date,
  rejectedAt: Date,
  deliveredAt: Date
}, { timestamps: true });

const bulkOrderSchema = new mongoose.Schema({
  orderCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyerName: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['vegetables', 'fruits', 'grains', 'dairy', 'organic', 'other'],
    required: true
  },
  unit: {
    type: String,
    enum: ['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter'],
    required: true
  },
  requestedQuantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  deliveryLocation: {
    type: String,
    required: true,
    trim: true
  },
  requiredBy: Date,
  qualityGrade: {
    type: String,
    enum: ['standard', 'premium', 'organic'],
    default: 'standard'
  },
  maxPricePerUnit: {
    type: Number,
    min: 0
  },
  message: {
    type: String,
    default: ''
  },
  allocations: [allocationSchema],
  status: {
    type: String,
    enum: [
      'sourcing',
      'partially_allocated',
      'awaiting_acceptance',
      'partially_confirmed',
      'confirmed',
      'partially_delivered',
      'delivered',
      'cancelled',
      'unfulfilled'
    ],
    default: 'sourcing'
  }
}, { timestamps: true });

bulkOrderSchema.virtual('allocatedQuantity').get(function getAllocatedQuantity() {
  return this.allocations
    .filter(a => !['rejected', 'cancelled'].includes(a.status))
    .reduce((sum, a) => sum + a.quantity, 0);
});

bulkOrderSchema.virtual('acceptedQuantity').get(function getAcceptedQuantity() {
  return this.allocations
    .filter(a => ['accepted', 'delivered'].includes(a.status))
    .reduce((sum, a) => sum + a.quantity, 0);
});

bulkOrderSchema.virtual('deliveredQuantity').get(function getDeliveredQuantity() {
  return this.allocations
    .filter(a => a.status === 'delivered')
    .reduce((sum, a) => sum + a.quantity, 0);
});

bulkOrderSchema.virtual('totalAmount').get(function getTotalAmount() {
  return this.allocations
    .filter(a => !['rejected', 'cancelled'].includes(a.status))
    .reduce((sum, a) => sum + a.totalAmount, 0);
});

bulkOrderSchema.set('toJSON', { virtuals: true });
bulkOrderSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('BulkOrder', bulkOrderSchema);
