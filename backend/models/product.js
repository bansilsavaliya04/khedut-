const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1200
  },
  category: {
    type: String,
    enum: ['vegetables', 'fruits', 'grains', 'dairy', 'organic', 'other'],
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0.01
  },
  unit: {
    type: String,
    enum: ['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter'],
    default: 'kg'
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  images: [{
    type: String,
    maxlength: 1_500_000
  }],
  location: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
    index: true
  },
  qualityGrade: {
    type: String,
    enum: ['standard', 'premium', 'organic'],
    default: 'standard'
  },
  farmingMethod: {
    type: String,
    enum: ['conventional', 'organic', 'natural'],
    default: 'conventional'
  },
  harvestDate: Date,
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  isAvailable: {
    type: Boolean,
    default: true,
    index: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    comment: { type: String, maxlength: 500 },
    rating: { type: Number, min: 1, max: 5 },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', location: 'text' });
productSchema.pre('save', function syncAvailability() {
  this.isAvailable = Number(this.quantity) > 0;
});

module.exports = mongoose.model('Product', productSchema);
