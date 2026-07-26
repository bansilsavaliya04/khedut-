const express = require('express');
const mongoose = require('mongoose');

const Chat = require('../models/chat');
const User = require('../models/user');
const Order = require('../models/order');
const BulkOrder = require('../models/bulkOrder');
const auth = require('../middleware/auth');
const { cleanText } = require('../utils/input');

const router = express.Router();

router.post('/send', auth, async (req, res) => {
  try {
    const receiverId = String(req.body.receiverId || '');
    const message = cleanText(req.body.message, { max: 1000, required: true });
    const originalLanguage = ['en', 'gu', 'hi'].includes(req.body.originalLanguage)
      ? req.body.originalLanguage
      : 'en';

    if (!mongoose.isValidObjectId(receiverId) || !message) {
      return res.status(400).json({ message: 'Valid receiver and message are required' });
    }
    if (receiverId === req.user.userId) {
      return res.status(400).json({ message: 'You cannot message yourself' });
    }

    const receiver = await User.findById(receiverId).select('_id isActive');
    if (!receiver || !receiver.isActive) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const chat = await Chat.create({
      senderId: req.user.userId,
      receiverId,
      originalMessage: message,
      translatedMessage: message,
      originalLanguage,
      translatedLanguage: originalLanguage
    });

    return res.status(201).json(chat);
  } catch (err) {
    console.error('Send chat error:', err.message);
    return res.status(500).json({ message: 'Failed to send message' });
  }
});

// Contacts are generated from orders and previous conversations, so users do not need to copy MongoDB IDs.
router.get('/contacts', auth, async (req, res) => {
  try {
    const myId = req.user.userId;
    const contactIds = new Set();

    const chatPartners = await Chat.find({
      $or: [{ senderId: myId }, { receiverId: myId }]
    }).select('senderId receiverId').lean();
    chatPartners.forEach(message => {
      const sender = String(message.senderId);
      const receiver = String(message.receiverId);
      contactIds.add(sender === myId ? receiver : sender);
    });

    if (req.user.role === 'buyer') {
      const directOrders = await Order.find({ buyerId: myId }).select('farmerId').lean();
      directOrders.forEach(order => contactIds.add(String(order.farmerId)));

      const bulkOrders = await BulkOrder.find({ buyerId: myId }).select('allocations.farmerId').lean();
      bulkOrders.forEach(order => order.allocations.forEach(a => contactIds.add(String(a.farmerId))));
    } else if (req.user.role === 'farmer') {
      const directOrders = await Order.find({ farmerId: myId }).select('buyerId').lean();
      directOrders.forEach(order => contactIds.add(String(order.buyerId)));

      const bulkOrders = await BulkOrder.find({ 'allocations.farmerId': myId }).select('buyerId').lean();
      bulkOrders.forEach(order => contactIds.add(String(order.buyerId)));
    }

    contactIds.delete(myId);
    const users = await User.find({ _id: { $in: [...contactIds] }, isActive: true })
      .select('name role location profileImage')
      .sort({ name: 1 });

    return res.json(users.map(user => ({
      id: user._id,
      name: user.name,
      role: user.role,
      location: user.location || '',
      profileImage: user.profileImage || ''
    })));
  } catch (err) {
    console.error('Chat contacts error:', err.message);
    return res.status(500).json({ message: 'Failed to load chat contacts' });
  }
});

router.patch('/read/:userId', auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }
    await Chat.updateMany({
      senderId: req.params.userId,
      receiverId: req.user.userId,
      readAt: null
    }, { $set: { readAt: new Date() } });
    return res.json({ message: 'Messages marked as read' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to update messages' });
  }
});

router.get('/:userId', auth, async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherId = req.params.userId;
    if (!mongoose.isValidObjectId(otherId)) {
      return res.status(400).json({ message: 'Invalid user id' });
    }

    const messages = await Chat.find({
      $or: [
        { senderId: myId, receiverId: otherId },
        { senderId: otherId, receiverId: myId }
      ]
    }).sort({ createdAt: 1 }).limit(500);

    await Chat.updateMany({ senderId: otherId, receiverId: myId, readAt: null }, {
      $set: { readAt: new Date() }
    });

    return res.json(messages);
  } catch (err) {
    console.error('Load chat error:', err.message);
    return res.status(500).json({ message: 'Failed to load messages' });
  }
});

module.exports = router;
