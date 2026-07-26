const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerName: { type: String, required: true },
  serviceType: {
    type: String,
    enum: ['tractor', 'harvester', 'rotavator', 'cultivator', 'sprayer', 'other'],
    required: true
  },
  serviceName: { type: String, required: true, trim: true, maxlength: 100 },
  ratePerHour: { type: Number, required: true, min: 0 },
  date: { type: String, required: true },
  time: { type: String, required: true },
  area: { type: Number, min: 0, default: 0 },
  hours: { type: Number, required: true, min: 1, max: 24 },
  location: { type: String, required: true, trim: true, maxlength: 160 },
  note: { type: String, trim: true, maxlength: 500, default: '' },
  totalCost: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending',
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
