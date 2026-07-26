const express = require('express');
const router = express.Router();

const BulkOrder = require('../models/bulkOrder');
const Product = require('../models/product');
const User = require('../models/user');
const auth = require('../middleware/auth');
const { cleanText, optionalDate } = require('../utils/input');

const CATEGORIES = ['vegetables', 'fruits', 'grains', 'dairy', 'organic', 'other'];
const UNITS = ['kg', 'quintal', 'ton', 'piece', 'dozen', 'liter'];
const QUALITY = ['standard', 'premium', 'organic'];

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MF-${time}-${random}`;
}

function activeAllocations(order) {
  return order.allocations.filter(a => !['rejected', 'cancelled'].includes(a.status));
}

function recomputeStatus(order) {
  if (order.status === 'cancelled') return;

  const active = activeAllocations(order);
  const allocated = active.reduce((sum, a) => sum + a.quantity, 0);
  const accepted = active
    .filter(a => ['accepted', 'delivered'].includes(a.status))
    .reduce((sum, a) => sum + a.quantity, 0);
  const delivered = active
    .filter(a => a.status === 'delivered')
    .reduce((sum, a) => sum + a.quantity, 0);

  if (delivered >= order.requestedQuantity) {
    order.status = 'delivered';
  } else if (delivered > 0) {
    order.status = 'partially_delivered';
  } else if (accepted >= order.requestedQuantity) {
    order.status = 'confirmed';
  } else if (accepted > 0) {
    order.status = 'partially_confirmed';
  } else if (allocated >= order.requestedQuantity) {
    order.status = 'awaiting_acceptance';
  } else if (allocated > 0) {
    order.status = 'partially_allocated';
  } else if (order.allocations.length > 0) {
    order.status = 'unfulfilled';
  } else {
    order.status = 'sourcing';
  }
}

async function reserveMatchingStock({
  productName,
  category,
  unit,
  maxPricePerUnit,
  qualityGrade,
  quantityNeeded,
  excludedProductIds = [],
  excludedFarmerIds = []
}) {
  let remaining = Number(quantityNeeded);
  const allocations = [];

  if (!Number.isFinite(remaining) || remaining <= 0) return allocations;

  const filter = {
    name: new RegExp(`^${escapeRegex(productName.trim())}$`, 'i'),
    category,
    unit,
    isAvailable: true,
    quantity: { $gt: 0 }
  };

  if (Number.isFinite(Number(maxPricePerUnit)) && Number(maxPricePerUnit) > 0) {
    filter.price = { $lte: Number(maxPricePerUnit) };
  }

  if (qualityGrade && qualityGrade !== 'standard') {
    filter.qualityGrade = qualityGrade;
  }

  if (excludedProductIds.length) {
    filter._id = { $nin: excludedProductIds };
  }

  if (excludedFarmerIds.length) {
    filter.farmer = { $nin: excludedFarmerIds };
  }

  const candidates = await Product.find(filter)
    .populate('farmer', 'name')
    .sort({ price: 1, createdAt: 1 });

  for (const candidate of candidates) {
    if (remaining <= 0) break;

    const take = Math.min(remaining, Number(candidate.quantity));
    if (take <= 0) continue;

    const reserved = await Product.findOneAndUpdate(
      {
        _id: candidate._id,
        isAvailable: true,
        quantity: { $gte: take }
      },
      { $inc: { quantity: -take } },
      { new: true }
    ).populate('farmer', 'name');

    if (!reserved) continue;

    if (!reserved.farmer) {
      await Product.findByIdAndUpdate(reserved._id, {
        $inc: { quantity: take },
        $set: { isAvailable: true }
      });
      continue;
    }

    if (reserved.quantity <= 0) {
      reserved.quantity = 0;
      reserved.isAvailable = false;
      await reserved.save();
    }

    allocations.push({
      farmerId: reserved.farmer._id,
      farmerName: reserved.farmer.name,
      productId: reserved._id,
      quantity: take,
      pricePerUnit: reserved.price,
      totalAmount: Number((take * reserved.price).toFixed(2)),
      status: 'pending',
      stockReserved: true
    });

    remaining -= take;
  }

  return allocations;
}

async function releaseAllocationStock(allocation) {
  if (!allocation.stockReserved) return;

  await Product.findByIdAndUpdate(allocation.productId, {
    $inc: { quantity: allocation.quantity },
    $set: { isAvailable: true }
  });

  allocation.stockReserved = false;
}

// Preview how a bulk order would be split before placement.
router.post('/preview', auth, async (req, res) => {
  try {
    if (req.user.role !== 'buyer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Buyer or admin access required' });
    }

    const { productName, category, unit, quantity, maxPricePerUnit, qualityGrade } = req.body;
    const requestedQuantity = Number(quantity);

    if (!productName || !CATEGORIES.includes(category) || !UNITS.includes(unit) ||
        !Number.isFinite(requestedQuantity) || requestedQuantity <= 0 ||
        (qualityGrade && !QUALITY.includes(qualityGrade))) {
      return res.status(400).json({ message: 'Valid product, category, unit, quality and quantity are required' });
    }

    const filter = {
      name: new RegExp(`^${escapeRegex(productName.trim())}$`, 'i'),
      category,
      unit,
      isAvailable: true,
      quantity: { $gt: 0 }
    };

    if (Number(maxPricePerUnit) > 0) filter.price = { $lte: Number(maxPricePerUnit) };
    if (qualityGrade && qualityGrade !== 'standard') filter.qualityGrade = qualityGrade;

    const products = await Product.find(filter)
      .populate('farmer', 'name location')
      .sort({ price: 1, createdAt: 1 });

    let remaining = requestedQuantity;
    const proposedAllocations = [];

    for (const product of products) {
      if (remaining <= 0) break;
      if (!product.farmer) continue;
      const allocated = Math.min(remaining, product.quantity);
      proposedAllocations.push({
        farmerId: product.farmer?._id,
        farmerName: product.farmer?.name || 'Farmer',
        farmerLocation: product.farmer?.location || product.location,
        productId: product._id,
        quantity: allocated,
        pricePerUnit: product.price,
        totalAmount: Number((allocated * product.price).toFixed(2))
      });
      remaining -= allocated;
    }

    res.json({
      requestedQuantity,
      availableQuantity: requestedQuantity - remaining,
      remainingQuantity: remaining,
      canFullyFulfill: remaining <= 0,
      farmerCount: new Set(proposedAllocations.map(a => String(a.farmerId))).size,
      proposedAllocations
    });
  } catch (err) {
    console.error('Bulk preview error:', err);
    res.status(500).json({ message: 'Unable to calculate fulfillment plan' });
  }
});

// Create one parent order and split it across matching farmer inventory.
router.post('/', auth, async (req, res) => {
  let allocations = [];
  let orderSaved = false;

  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Only buyers can create bulk orders' });
    }

    const {
      productName,
      category,
      unit,
      quantity,
      deliveryLocation,
      requiredBy,
      qualityGrade,
      maxPricePerUnit,
      message
    } = req.body;

    const requestedQuantity = Number(quantity);

    const requiredDate = optionalDate(requiredBy);
    if (!productName || !CATEGORIES.includes(category) || !UNITS.includes(unit) ||
        !deliveryLocation || !Number.isFinite(requestedQuantity) || requestedQuantity <= 0 ||
        (qualityGrade && !QUALITY.includes(qualityGrade)) || requiredDate === null) {
      return res.status(400).json({
        message: 'Valid product, category, unit, quantity, delivery location, quality and date are required'
      });
    }

    const buyer = await User.findById(req.user.userId).select('name');
    if (!buyer) return res.status(404).json({ message: 'Buyer not found' });

    allocations = await reserveMatchingStock({
      productName,
      category,
      unit,
      maxPricePerUnit,
      qualityGrade: qualityGrade || 'standard',
      quantityNeeded: requestedQuantity
    });

    if (!allocations.length) {
      return res.status(400).json({
        message: 'No matching farmer stock is currently available. Try another quantity, unit or maximum price.'
      });
    }

    const order = new BulkOrder({
      orderCode: makeOrderCode(),
      buyerId: buyer._id,
      buyerName: buyer.name,
      productName: cleanText(productName, { max: 100, required: true }),
      category,
      unit,
      requestedQuantity,
      deliveryLocation: cleanText(deliveryLocation, { max: 160, required: true }),
      requiredBy: requiredDate,
      qualityGrade: qualityGrade || 'standard',
      maxPricePerUnit: Number(maxPricePerUnit) > 0 ? Number(maxPricePerUnit) : undefined,
      message: cleanText(message, { max: 500 }),
      allocations
    });

    recomputeStatus(order);
    await order.save();
    orderSaved = true;

    res.status(201).json({
      message: allocations.reduce((sum, a) => sum + a.quantity, 0) >= requestedQuantity
        ? `Order split successfully across ${new Set(allocations.map(a => String(a.farmerId))).size} farmer(s)`
        : 'Order partially allocated. The system will keep the unfilled quantity visible for reallocation.',
      order
    });
  } catch (err) {
    console.error('Create bulk order error:', err);

    if (!orderSaved && allocations.length) {
      await Promise.all(allocations.map(a => Product.findByIdAndUpdate(a.productId, {
        $inc: { quantity: a.quantity },
        $set: { isAvailable: true }
      }).catch(() => null)));
    }

    res.status(500).json({ message: 'Unable to create multi-farmer order' });
  }
});

router.get('/buyer', auth, async (req, res) => {
  try {
    if (req.user.role !== 'buyer') {
      return res.status(403).json({ message: 'Buyer access required' });
    }

    const orders = await BulkOrder.find({ buyerId: req.user.userId })
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to load bulk orders' });
  }
});

router.get('/farmer', auth, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const orders = await BulkOrder.find({ 'allocations.farmerId': req.user.userId })
      .sort({ createdAt: -1 });

    const farmerOrders = [];
    orders.forEach(order => {
      order.allocations
        .filter(a => String(a.farmerId) === req.user.userId)
        .forEach(a => farmerOrders.push({
          bulkOrderId: order._id,
          orderCode: order.orderCode,
          buyerId: order.buyerId,
          buyerName: order.buyerName,
          productName: order.productName,
          category: order.category,
          unit: order.unit,
          deliveryLocation: order.deliveryLocation,
          requiredBy: order.requiredBy,
          parentStatus: order.status,
          allocationId: a._id,
          quantity: a.quantity,
          pricePerUnit: a.pricePerUnit,
          totalAmount: a.totalAmount,
          status: a.status,
          createdAt: a.createdAt
        }));
    });

    farmerOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(farmerOrders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to load farmer allocations' });
  }
});

router.get('/admin', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orders = await BulkOrder.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to load bulk orders' });
  }
});

router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orders = await BulkOrder.find();
    const allocatedQuantity = orders.reduce((sum, o) => sum + o.allocatedQuantity, 0);
    const deliveredQuantity = orders.reduce((sum, o) => sum + o.deliveredQuantity, 0);
    const grossValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    res.json({
      totalBulkOrders: orders.length,
      allocatedQuantity,
      deliveredQuantity,
      grossValue,
      fullyDelivered: orders.filter(o => o.status === 'delivered').length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to load bulk order analytics' });
  }
});

router.patch('/allocations/:allocationId/accept', auth, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const order = await BulkOrder.findOne({
      allocations: {
        $elemMatch: {
          _id: req.params.allocationId,
          farmerId: req.user.userId
        }
      }
    });

    if (!order) return res.status(404).json({ message: 'Allocation not found' });

    const allocation = order.allocations.id(req.params.allocationId);
    if (allocation.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending allocations can be accepted' });
    }

    allocation.status = 'accepted';
    allocation.acceptedAt = new Date();
    recomputeStatus(order);
    await order.save();

    res.json({ message: 'Your allocated quantity is confirmed', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to accept allocation' });
  }
});

router.patch('/allocations/:allocationId/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const order = await BulkOrder.findOne({
      allocations: {
        $elemMatch: {
          _id: req.params.allocationId,
          farmerId: req.user.userId
        }
      }
    });

    if (!order) return res.status(404).json({ message: 'Allocation not found' });

    const allocation = order.allocations.id(req.params.allocationId);
    if (allocation.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending allocations can be rejected' });
    }

    await releaseAllocationStock(allocation);
    allocation.status = 'rejected';
    allocation.rejectedAt = new Date();

    const allocatedNow = activeAllocations(order).reduce((sum, a) => sum + a.quantity, 0);
    const missingQuantity = Math.max(0, order.requestedQuantity - allocatedNow);

    if (missingQuantity > 0) {
      const replacementAllocations = await reserveMatchingStock({
        productName: order.productName,
        category: order.category,
        unit: order.unit,
        maxPricePerUnit: order.maxPricePerUnit,
        qualityGrade: order.qualityGrade,
        quantityNeeded: missingQuantity,
        excludedProductIds: order.allocations.map(a => a.productId),
        excludedFarmerIds: [req.user.userId]
      });
      order.allocations.push(...replacementAllocations);
    }

    recomputeStatus(order);
    await order.save();

    res.json({
      message: 'Allocation rejected. Reserved stock was released and replacement matching was attempted.',
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to reject allocation' });
  }
});

router.patch('/allocations/:allocationId/deliver', auth, async (req, res) => {
  try {
    if (req.user.role !== 'farmer') {
      return res.status(403).json({ message: 'Farmer access required' });
    }

    const order = await BulkOrder.findOne({
      allocations: {
        $elemMatch: {
          _id: req.params.allocationId,
          farmerId: req.user.userId
        }
      }
    });

    if (!order) return res.status(404).json({ message: 'Allocation not found' });

    const allocation = order.allocations.id(req.params.allocationId);
    if (allocation.status !== 'accepted') {
      return res.status(400).json({ message: 'Only accepted allocations can be delivered' });
    }

    allocation.status = 'delivered';
    allocation.deliveredAt = new Date();
    recomputeStatus(order);
    await order.save();

    res.json({ message: 'Allocated quantity marked as delivered', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to mark allocation delivered' });
  }
});

router.post('/:id/reallocate', auth, async (req, res) => {
  try {
    const order = await BulkOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Bulk order not found' });

    const isOwner = String(order.buyerId) === req.user.userId;
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const allocated = activeAllocations(order).reduce((sum, a) => sum + a.quantity, 0);
    const missingQuantity = Math.max(0, order.requestedQuantity - allocated);

    if (missingQuantity <= 0) {
      return res.json({ message: 'Order is already fully allocated', order });
    }

    const replacements = await reserveMatchingStock({
      productName: order.productName,
      category: order.category,
      unit: order.unit,
      maxPricePerUnit: order.maxPricePerUnit,
      qualityGrade: order.qualityGrade,
      quantityNeeded: missingQuantity,
      excludedProductIds: order.allocations.map(a => a.productId),
      excludedFarmerIds: order.allocations
        .filter(a => ['rejected', 'cancelled'].includes(a.status))
        .map(a => a.farmerId)
    });

    order.allocations.push(...replacements);
    recomputeStatus(order);
    await order.save();

    res.json({
      message: replacements.length
        ? 'Additional farmer stock has been allocated'
        : 'No additional matching stock is available yet',
      order
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to reallocate order' });
  }
});

router.patch('/:id/cancel', auth, async (req, res) => {
  try {
    const order = await BulkOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Bulk order not found' });

    if (String(order.buyerId) !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const hasConfirmedAllocation = order.allocations.some(a =>
      ['accepted', 'delivered'].includes(a.status)
    );

    if (hasConfirmedAllocation) {
      return res.status(400).json({
        message: 'Confirmed farmer allocations cannot be cancelled directly. Contact the admin.'
      });
    }

    for (const allocation of order.allocations) {
      if (allocation.status === 'pending') {
        await releaseAllocationStock(allocation);
        allocation.status = 'cancelled';
      }
    }

    order.status = 'cancelled';
    await order.save();

    res.json({ message: 'Bulk order cancelled and reserved stock released', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unable to cancel bulk order' });
  }
});


router.patch('/:id/admin-cancel', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const order = await BulkOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Bulk order not found' });
    if (['delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: 'This bulk order cannot be cancelled' });
    }

    for (const allocation of order.allocations) {
      if (allocation.stockReserved && allocation.status !== 'delivered') {
        await releaseAllocationStock(allocation);
      }
      if (allocation.status !== 'delivered') allocation.status = 'cancelled';
    }

    order.status = 'cancelled';
    await order.save();
    return res.json({ message: 'Bulk order cancelled by admin and available stock released', order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unable to cancel bulk order' });
  }
});

module.exports = router;
module.exports.__test = { recomputeStatus, makeOrderCode, activeAllocations };
