const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 80
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['farmer', 'buyer', 'admin'],
    default: 'buyer',
    index: true
  },
  language: {
    type: String,
    enum: ['en', 'gu', 'hi'],
    default: 'gu'
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    maxlength: 160,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: Date
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
