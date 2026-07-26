const express = require('express');

const Booking = require('../models/Booking');
const User = require('../models/user');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { cleanText, positiveNumber } = require('../utils/input');

const router = express.Router();
const SERVICE_RATES = {
  tractor: 900,
  harvester: 2200,
  rotavator: 1200,
  cultivator: 1000,
  sprayer: 700,
  other: 800
};

router.get('/rates', (req, res) => {
  return res.json(SERVICE_RATES);
});

router.get('/mine', auth, requireRole('buyer'), async (req, res) => {
  try {
    const bookings = await Booking.find({ buyerId: req.user.userId }).sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load bookings' });
  }
});

router.get('/admin', auth, requireRole('admin'), async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load bookings' });
  }
});

router.post('/', auth, requireRole('buyer'), async (req, res) => {
  try {
    const serviceType = Object.hasOwn(SERVICE_RATES, req.body.serviceType)
      ? req.body.serviceType
      : null;
    const hours = positiveNumber(req.body.hours, { min: 1, max: 24 });
    const area = req.body.area === '' || req.body.area === undefined
      ? 0
      : positiveNumber(req.body.area, { min: 0.01, max: 100000 });
    const date = cleanText(req.body.date, { max: 10, required: true });
    const time = cleanText(req.body.time, { max: 8, required: true });
    const location = cleanText(req.body.location, { max: 160, required: true });

    if (!serviceType || hours === null || area === null || !date || !time || !location) {
      return res.status(400).json({ message: 'Valid service, date, time, hours and location are required' });
    }

    const bookingDate = new Date(`${date}T${time}`);
    if (Number.isNaN(bookingDate.getTime()) || bookingDate.getTime() < Date.now() - 60_000) {
      return res.status(400).json({ message: 'Booking date and time must be in the future' });
    }

    const buyer = await User.findById(req.user.userId).select('name');
    if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

    const ratePerHour = SERVICE_RATES[serviceType];
    const serviceName = serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
    const totalCost = Number((ratePerHour * hours).toFixed(2));

    const booking = await Booking.create({
      buyerId: buyer._id,
      buyerName: buyer.name,
      serviceType,
      serviceName,
      ratePerHour,
      date,
      time,
      area,
      hours,
      location,
      note: cleanText(req.body.note, { max: 500 }),
      totalCost,
      status: 'pending'
    });

    return res.status(201).json({ message: 'Equipment booking created', booking });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to create booking' });
  }
});

router.patch('/:id/cancel', auth, requireRole('buyer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, buyerId: req.user.userId });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'This booking cannot be cancelled' });
    }
    booking.status = 'cancelled';
    await booking.save();
    return res.json({ message: 'Booking cancelled', booking });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to cancel booking' });
  }
});

router.patch('/:id/status', auth, requireRole('admin'), async (req, res) => {
  try {
    const allowed = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    return res.json({ message: 'Booking status updated', booking });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to update booking' });
  }
});

module.exports = router;
module.exports.__test = { SERVICE_RATES };
