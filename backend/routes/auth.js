const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const {
  cleanText,
  normalizeEmail,
  isValidEmail,
  isValidPhone,
  safeRole,
  timingSafeEqualText
} = require('../utils/input');

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || '',
    location: user.location || '',
    language: user.language || 'gu',
    isVerified: Boolean(user.isVerified),
    createdAt: user.createdAt
  };
}

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured');
  return jwt.sign(
    { userId: String(user._id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function validateAccountInput(body, { allowAdmin = false } = {}) {
  const name = cleanText(body.name, { max: 80, required: true });
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const phone = cleanText(body.phone, { max: 20 });
  const location = cleanText(body.location, { max: 160 });
  const role = safeRole(body.role || 'buyer', allowAdmin
    ? ['buyer', 'farmer', 'admin']
    : ['buyer', 'farmer']);

  if (!name || !isValidEmail(email)) {
    return { error: 'A valid name and email address are required' };
  }
  if (password.length < 6 || password.length > 72) {
    return { error: 'Password must contain 6 to 72 characters' };
  }
  if (!isValidPhone(phone)) {
    return { error: 'Enter a valid phone number' };
  }
  if (!role) {
    return { error: 'Invalid account role' };
  }

  return { name, email, password, phone, location, role };
}

async function createAccount(details) {
  const existingUser = await User.findOne({ email: details.email });
  if (existingUser) {
    const error = new Error('Email already registered!');
    error.status = 409;
    throw error;
  }

  const password = await bcrypt.hash(details.password, 10);
  return User.create({
    name: details.name,
    email: details.email,
    password,
    role: details.role,
    phone: details.phone,
    location: details.location,
    language: details.language || 'gu',
    isVerified: details.role === 'admin'
  });
}

// Public registration only creates buyer or farmer accounts.
router.post('/register', async (req, res) => {
  try {
    const details = validateAccountInput(req.body);
    if (details.error) return res.status(400).json({ message: details.error });

    const user = await createAccount(details);
    return res.status(201).json({
      message: 'Registration successful!',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(err.status || 500).json({
      message: err.status ? err.message : 'Unable to register account'
    });
  }
});

// Lets the owner create the first admin with a one-time setup key from .env.
router.get('/admin/setup-status', async (req, res) => {
  try {
    const adminExists = await User.exists({ role: 'admin' });
    return res.json({
      adminExists: Boolean(adminExists),
      setupEnabled: Boolean(process.env.ADMIN_SETUP_KEY)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to check admin setup status' });
  }
});

router.post('/admin/setup', async (req, res) => {
  try {
    if (!process.env.ADMIN_SETUP_KEY) {
      return res.status(503).json({ message: 'Admin setup is not enabled in backend/.env' });
    }

    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
      return res.status(409).json({
        message: 'An admin already exists. A current admin can create additional admin accounts from the dashboard.'
      });
    }

    if (!timingSafeEqualText(req.body.setupKey, process.env.ADMIN_SETUP_KEY)) {
      return res.status(403).json({ message: 'Invalid admin setup key' });
    }

    const details = validateAccountInput({ ...req.body, role: 'admin' }, { allowAdmin: true });
    if (details.error) return res.status(400).json({ message: details.error });

    const user = await createAccount(details);
    return res.status(201).json({
      message: 'First admin account created successfully!',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Admin setup error:', err.message);
    return res.status(err.status || 500).json({
      message: err.status ? err.message : 'Unable to create admin account'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return res.status(400).json({ message: 'Invalid email or password!' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password!' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return res.json({
      message: 'Login successful!',
      token: signToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Unable to login' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isActive) return res.status(404).json({ message: 'User not found' });
    return res.json(publicUser(user));
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load profile' });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    const name = cleanText(req.body.name, { max: 80, required: true });
    const phone = cleanText(req.body.phone, { max: 20 });
    const location = cleanText(req.body.location, { max: 160 });
    const language = ['en', 'gu', 'hi'].includes(req.body.language) ? req.body.language : undefined;

    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!isValidPhone(phone)) return res.status(400).json({ message: 'Enter a valid phone number' });

    const updates = { name, phone, location };
    if (language) updates.language = language;

    const user = await User.findByIdAndUpdate(req.user.userId, updates, {
      new: true,
      runValidators: true
    });
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ message: 'Profile updated', user: publicUser(user) });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update profile' });
  }
});

router.patch('/me/password', auth, async (req, res) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 6 || newPassword.length > 72) {
      return res.status(400).json({ message: 'New password must contain 6 to 72 characters' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to change password' });
  }
});

router.get('/users', auth, requireRole('admin'), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json(users.map(publicUser));
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load users' });
  }
});

// Existing admins can create buyer, farmer, or additional admin accounts.
router.post('/users', auth, requireRole('admin'), async (req, res) => {
  try {
    const details = validateAccountInput(req.body, { allowAdmin: true });
    if (details.error) return res.status(400).json({ message: details.error });
    const user = await createAccount(details);
    return res.status(201).json({ message: `${details.role} account created`, user: publicUser(user) });
  } catch (err) {
    return res.status(err.status || 500).json({
      message: err.status ? err.message : 'Unable to create user'
    });
  }
});

router.patch('/users/:id/role', auth, requireRole('admin'), async (req, res) => {
  try {
    const role = safeRole(req.body.role, ['buyer', 'farmer', 'admin']);
    if (!role) return res.status(400).json({ message: 'Invalid role' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) return res.status(400).json({ message: 'The last admin cannot be demoted' });
    }

    target.role = role;
    await target.save();
    return res.json({ message: 'User role updated', user: publicUser(target) });
  } catch (err) {
    return res.status(400).json({ message: err.message || 'Unable to update role' });
  }
});

router.delete('/users/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'You cannot delete your own admin account' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });

    if (target.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) return res.status(400).json({ message: 'The last admin cannot be deleted' });
    }

    await target.deleteOne();
    return res.json({ message: 'User deleted!' });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to delete user' });
  }
});

module.exports = router;
module.exports.__test = { validateAccountInput, publicUser };
