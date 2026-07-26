const express = require('express');
const mongoose = require('mongoose');

const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { cleanText, positiveNumber } = require('../utils/input');

const router = express.Router();

async function releaseReservedStock(order) {
  if (!order.stockReserved) return;
  await Product.findByIdAndUpdate(order.productId, {
    $inc: { quantity: order.quantity },
    $set: { isAvailable: true }
  });
  order.stockReserved = false;
}

router.post('/', auth, requireRole('buyer'), async (req, res) => {
  let reservedProduct = null;
  const requestedQuantity = positiveNumber(req.body.quantity, { min: 0.01, max: 10_000_000 });

  try {
    if (!mongoose.isValidObjectId(req.body.productId) || requestedQuantity === null) {
      return res.status(400).json({ message: 'Valid product and quantity are required' });
    }

    reservedProduct = await Product.findOneAndUpdate(
      {
        _id: req.body.productId,
        isAvailable: true,
        quantity: { $gte: requestedQuantity }
      },
      { $inc: { quantity: -requestedQuantity } },
      { new: true }
    ).populate('farmer', 'name');

    if (!reservedProduct) {
      return res.status(400).json({ message: 'Requested stock is no longer available' });
    }

    if (!reservedProduct.farmer) {
      await Product.findByIdAndUpdate(reservedProduct._id, {
        $inc: { quantity: requestedQuantity },
        $set: { isAvailable: true }
      });
      reservedProduct = null;
      return res.status(400).json({ message: 'This listing is no longer connected to an active farmer' });
    }

    if (reservedProduct.quantity <= 0) {
      reservedProduct.quantity = 0;
      reservedProduct.isAvailable = false;
      await reservedProduct.save();
    }

    const buyer = await User.findById(req.user.userId).select('name');
    if (!buyer) {
      await Product.findByIdAndUpdate(req.body.productId, {
        $inc: { quantity: requestedQuantity },
        $set: { isAvailable: true }
      });
      reservedProduct = null;
      return res.status(404).json({ message: 'Buyer not found' });
    }

    const totalAmount = Number((requestedQuantity * reservedProduct.price).toFixed(2));
    const order = await Order.create({
      productId: reservedProduct._id,
      productName: reservedProduct.name,
      buyerId: buyer._id,
      buyerName: buyer.name,
      farmerId: reservedProduct.farmer._id,
      farmerName: reservedProduct.farmer.name,
      unit: reservedProduct.unit,
      quantity: requestedQuantity,
      pricePerUnit: reservedProduct.price,
      totalAmount,
      message: cleanText(req.body.message, { max: 500 }),
      stockReserved: true,
      status: 'pending'
    });

    reservedProduct = null;
    return res.status(201).json({ message: 'Order placed successfully', order });
  } catch (err) {
    console.error('Create order error:', err.message);
    if (reservedProduct) {
      await Product.findByIdAndUpdate(reservedProduct._id, {
        $inc: { quantity: requestedQuantity || 0 },
        $set: { isAvailable: true }
      }).catch(() => {});
    }
    return res.status(500).json({ message: 'Unable to create order' });
  }
});

router.get('/buyer', auth, requireRole('buyer'), async (req, res) => {
  try {
    const orders = await Order.find({ buyerId: req.user.userId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load buyer orders' });
  }
});

router.get('/farmer', auth, requireRole('farmer'), async (req, res) => {
  try {
    const orders = await Order.find({ farmerId: req.user.userId }).sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load farmer orders' });
  }
});

router.patch('/:id/accept', auth, requireRole('farmer'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.farmerId) !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Only pending orders can be accepted' });

    // Compatibility with orders made before stock reservation was added.
    if (!order.stockReserved) {
      const product = await Product.findOneAndUpdate(
        { _id: order.productId, isAvailable: true, quantity: { $gte: order.quantity } },
        { $inc: { quantity: -order.quantity } },
        { new: true }
      );
      if (!product) return res.status(400).json({ message: 'Not enough stock available' });
      if (product.quantity <= 0) {
        product.quantity = 0;
        product.isAvailable = false;
        await product.save();
      }
      order.stockReserved = true;
    }

    order.status = 'accepted';
    order.acceptedAt = new Date();
    await order.save();
    return res.json({ message: 'Order accepted successfully', order });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to accept order' });
  }
});

router.patch('/:id/reject', auth, requireRole('farmer'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.farmerId) !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Only pending orders can be rejected' });

    await releaseReservedStock(order);
    order.status = 'rejected';
    order.rejectedAt = new Date();
    await order.save();
    return res.json({ message: 'Order rejected and reserved stock released', order });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to reject order' });
  }
});

router.patch('/:id/deliver', auth, requireRole('farmer'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.farmerId) !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });
    if (order.status !== 'accepted') return res.status(400).json({ message: 'Only accepted orders can be delivered' });

    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();
    return res.json({ message: 'Order marked as delivered', order });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to deliver order' });
  }
});

router.patch('/:id/cancel', auth, requireRole('buyer'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.buyerId) !== req.user.userId) return res.status(403).json({ message: 'Unauthorized' });
    if (order.status !== 'pending') return res.status(400).json({ message: 'Only pending orders can be cancelled' });

    await releaseReservedStock(order);
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    return res.json({ message: 'Order cancelled and reserved stock released', order });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to cancel order' });
  }
});

router.get('/farmer/stats', auth, requireRole('farmer'), async (req, res) => {
  try {
    const orders = await Order.find({ farmerId: req.user.userId });
    const products = await Product.find({ farmer: req.user.userId }).select('rating quantity isAvailable');
    const completed = orders.filter(o => ['accepted', 'delivered'].includes(o.status));
    const ratings = products.filter(p => p.rating > 0).map(p => p.rating);

    return res.json({
      totalOrders: orders.length,
      acceptedOrders: orders.filter(o => o.status === 'accepted').length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      rejectedOrders: orders.filter(o => o.status === 'rejected').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      revenue: Number(completed.reduce((sum, o) => sum + o.totalAmount, 0).toFixed(2)),
      activeProducts: products.filter(p => p.isAvailable).length,
      totalStock: products.reduce((sum, p) => sum + p.quantity, 0),
      averageRating: ratings.length
        ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1))
        : 0
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load farmer analytics' });
  }
});

router.get('/admin/stats', auth, requireRole('admin'), async (req, res) => {
  try {
    const orders = await Order.find();
    return res.json({
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      acceptedOrders: orders.filter(o => o.status === 'accepted').length,
      deliveredOrders: orders.filter(o => o.status === 'delivered').length,
      cancelledOrders: orders.filter(o => ['cancelled', 'rejected'].includes(o.status)).length,
      totalRevenue: Number(orders
        .filter(o => ['accepted', 'delivered'].includes(o.status))
        .reduce((sum, o) => sum + o.totalAmount, 0)
        .toFixed(2))
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load admin analytics' });
  }
});

router.get('/admin/orders', auth, requireRole('admin'), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.json(orders);
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load orders' });
  }
});

router.patch('/admin/:id/cancel', auth, requireRole('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (['delivered', 'cancelled', 'rejected'].includes(order.status)) {
      return res.status(400).json({ message: 'This order cannot be cancelled' });
    }

    await releaseReservedStock(order);
    order.status = 'cancelled';
    order.cancelledAt = new Date();
    await order.save();
    return res.json({ message: 'Order cancelled by admin', order });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to cancel order' });
  }
});

module.exports = router;
module.exports.__test = { releaseReservedStock };
