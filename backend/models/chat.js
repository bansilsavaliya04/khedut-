const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalMessage: { type: String, required: true, trim: true, maxlength: 1000 },
  translatedMessage: { type: String, default: '' },
  originalLanguage: { type: String, enum: ['en', 'gu', 'hi'], default: 'en' },
  translatedLanguage: { type: String, enum: ['en', 'gu', 'hi'], default: 'en' },
  readAt: Date
}, { timestamps: true });

chatSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

module.exports = mongoose.model('Chat', chatSchema);
