const express = require('express');
const mongoose = require('mongoose');

const Product = require('../models/product');
const Order = require('../models/order');
const BulkOrder = require('../models/bulkOrder');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { cleanText, positiveNumber, optionalDate, cleanImages } = require('../utils/input');

const router = express.Router();
const CATEGORIES = ['vegetables', 'fruits', 'grains', 'dairy', 'organic', 'other'];
const UNITS = ['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter'];
const QUALITY = ['standard', 'premium', 'organic'];
const METHODS = ['conventional', 'organic', 'natural'];

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function productPayload(body, { partial = false } = {}) {
  const payload = {};

  const name = cleanText(body.name, { max: 100, required: !partial });
  const description = cleanText(body.description, { max: 1200, required: !partial });
  const location = cleanText(body.location, { max: 160, required: !partial });

  if (!partial || body.name !== undefined) {
    if (!name) return { error: 'Product name is required' };
    payload.name = name;
  }
  if (!partial || body.description !== undefined) {
    if (!description) return { error: 'Product description is required' };
    payload.description = description;
  }
  if (!partial || body.location !== undefined) {
    if (!location) return { error: 'Product location is required' };
    payload.location = location;
  }

  if (!partial || body.category !== undefined) {
    if (!CATEGORIES.includes(body.category)) return { error: 'Invalid product category' };
    payload.category = body.category;
  }
  if (!partial || body.unit !== undefined) {
    if (!UNITS.includes(body.unit)) return { error: 'Invalid product unit' };
    payload.unit = body.unit;
  }
  if (!partial || body.price !== undefined) {
    const price = positiveNumber(body.price, { min: 0.01, max: 10_000_000 });
    if (price === null) return { error: 'Enter a valid price' };
    payload.price = price;
  }
  if (!partial || body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity < 0 || quantity > 10_000_000) {
      return { error: 'Enter a valid quantity' };
    }
    payload.quantity = quantity;
    payload.isAvailable = quantity > 0;
  }

  if (body.images !== undefined) payload.images = cleanImages(body.images);
  if (body.qualityGrade !== undefined) {
    if (!QUALITY.includes(body.qualityGrade)) return { error: 'Invalid quality grade' };
    payload.qualityGrade = body.qualityGrade;
  }
  if (body.farmingMethod !== undefined) {
    if (!METHODS.includes(body.farmingMethod)) return { error: 'Invalid farming method' };
    payload.farmingMethod = body.farmingMethod;
  }
  if (body.harvestDate !== undefined) {
    const harvestDate = optionalDate(body.harvestDate);
    if (harvestDate === null) return { error: 'Invalid harvest date' };
    payload.harvestDate = harvestDate;
  }

  return payload;
}

router.get('/', async (req, res) => {
  try {
    const { category, location, minPrice, maxPrice, search, qualityGrade, farmingMethod, sort } = req.query;
    const filter = { isAvailable: true, quantity: { $gt: 0 } };

    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (qualityGrade && QUALITY.includes(qualityGrade)) filter.qualityGrade = qualityGrade;
    if (farmingMethod && METHODS.includes(farmingMethod)) filter.farmingMethod = farmingMethod;
    if (location) filter.location = new RegExp(escapeRegex(cleanText(location, { max: 100 })), 'i');
    if (search) {
      const term = cleanText(search, { max: 100 });
      filter.$or = [
        { name: new RegExp(escapeRegex(term), 'i') },
        { description: new RegExp(escapeRegex(term), 'i') },
        { location: new RegExp(escapeRegex(term), 'i') }
      ];
    }

    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      filter.price = {};
      if (Number.isFinite(min)) filter.price.$gte = min;
      if (Number.isFinite(max)) filter.price.$lte = max;
    }

    const sortOptions = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      quantity_desc: { quantity: -1 },
      newest: { createdAt: -1 }
    };

    const products = await Product.find(filter)
      .populate('farmer', 'name location phone email')
      .sort(sortOptions[sort] || sortOptions.newest);

    return res.json(products);
  } catch (err) {
    console.error('Load products error:', err.message);
    return res.status(500).json({ message: 'Unable to load products' });
  }
});

router.get('/farmer', auth, requireRole('farmer'), async (req, res) => {
  try {
    const products = await Product.find({ farmer: req.user.userId }).sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load farmer products' });
  }
});

router.get('/admin/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const products = await Product.find()
      .populate('farmer', 'name location phone email')
      .sort({ createdAt: -1 });
    return res.json(products);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }
    const product = await Product.findById(req.params.id)
      .populate('farmer', 'name location phone email');
    if (!product) return res.status(404).json({ message: 'Product not found!' });
    return res.json(product);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load product' });
  }
});

router.post('/', auth, requireRole('farmer'), async (req, res) => {
  try {
    const payload = productPayload(req.body);
    if (payload.error) return res.status(400).json({ message: payload.error });

    const product = await Product.create({ ...payload, farmer: req.user.userId });
    return res.status(201).json(product);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to add product' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id' });
    }
    const payload = productPayload(req.body, { partial: true });
    if (payload.error) return res.status(400).json({ message: payload.error });

    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, farmer: req.user.userId };

    const product = await Product.findOneAndUpdate(filter, payload, {
      new: true,
      runValidators: true
    });
    if (!product) return res.status(404).json({ message: 'Product not found or unauthorized' });
    return res.json(product);
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update product' });
  }
});

router.post('/:id/reviews', auth, requireRole('buyer'), async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    const comment = cleanText(req.body.comment, { max: 500 });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const [deliveredOrder, deliveredBulkOrder] = await Promise.all([
      Order.exists({
        productId: req.params.id,
        buyerId: req.user.userId,
        status: 'delivered'
      }),
      BulkOrder.exists({
        buyerId: req.user.userId,
        allocations: {
          $elemMatch: { productId: req.params.id, status: 'delivered' }
        }
      })
    ]);
    if (!deliveredOrder && !deliveredBulkOrder) {
      return res.status(403).json({ message: 'Only buyers with a delivered order can review this product' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const existing = product.reviews.find(r => String(r.buyer) === req.user.userId);
    if (existing) {
      existing.rating = rating;
      existing.comment = comment;
      existing.createdAt = new Date();
    } else {
      product.reviews.push({ buyer: req.user.userId, rating, comment });
    }
    product.rating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
    await product.save();

    return res.json({ message: 'Review saved', rating: product.rating, reviews: product.reviews });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to save review' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'admin'
      ? { _id: req.params.id }
      : { _id: req.params.id, farmer: req.user.userId };

    const [activeOrders, activeBulkOrders] = await Promise.all([
      Order.exists({
        productId: req.params.id,
        status: { $in: ['pending', 'accepted'] }
      }),
      BulkOrder.exists({
        status: { $nin: ['delivered', 'cancelled'] },
        allocations: {
          $elemMatch: {
            productId: req.params.id,
            status: { $in: ['pending', 'accepted'] }
          }
        }
      })
    ]);
    if (activeOrders || activeBulkOrders) {
      return res.status(409).json({ message: 'This product has active orders and cannot be deleted yet' });
    }

    const deleted = await Product.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ message: 'Product not found or unauthorized' });
    return res.json({ message: 'Product deleted!' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to delete product' });
  }
});

module.exports = router;
module.exports.__test = { productPayload };
