const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/user');
const Product = require('../models/product');

async function upsertUser({ name, email, password, role, phone, location }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  return User.findOneAndUpdate(
    { email },
    { name, email, password: hashedPassword, role, phone, location, isVerified: true },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function upsertProduct(farmer, details) {
  return Product.findOneAndUpdate(
    { farmer: farmer._id, name: details.name, unit: details.unit },
    { ...details, farmer: farmer._id, isAvailable: details.quantity > 0 },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing. Create backend/.env from backend/.env.example first.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const admin = await upsertUser({
    name: 'Demo Admin',
    email: 'admin@khedutconnect.demo',
    password: 'Admin@123',
    role: 'admin',
    phone: '9000000000',
    location: 'Gujarat'
  });

  const buyer = await upsertUser({
    name: 'Demo Bulk Buyer',
    email: 'buyer@khedutconnect.demo',
    password: 'Buyer@123',
    role: 'buyer',
    phone: '9000000001',
    location: 'Rajkot APMC'
  });

  const farmer1 = await upsertUser({
    name: 'Kishan Patel',
    email: 'farmer1@khedutconnect.demo',
    password: 'Farmer@123',
    role: 'farmer',
    phone: '9000000011',
    location: 'Junagadh'
  });

  const farmer2 = await upsertUser({
    name: 'Ramesh Solanki',
    email: 'farmer2@khedutconnect.demo',
    password: 'Farmer@123',
    role: 'farmer',
    phone: '9000000012',
    location: 'Gondal'
  });

  const farmer3 = await upsertUser({
    name: 'Mehul Parmar',
    email: 'farmer3@khedutconnect.demo',
    password: 'Farmer@123',
    role: 'farmer',
    phone: '9000000013',
    location: 'Amreli'
  });

  await Promise.all([
    upsertProduct(farmer1, {
      name: 'Wheat',
      description: 'Grade A cleaned wheat suitable for wholesale supply.',
      category: 'grains',
      price: 31,
      unit: 'kg',
      quantity: 180,
      location: 'Junagadh'
    }),
    upsertProduct(farmer2, {
      name: 'Wheat',
      description: 'Freshly harvested wheat with moisture-controlled storage.',
      category: 'grains',
      price: 32,
      unit: 'kg',
      quantity: 170,
      location: 'Gondal'
    }),
    upsertProduct(farmer3, {
      name: 'Wheat',
      description: 'Premium wheat packed for bulk market delivery.',
      category: 'grains',
      price: 33,
      unit: 'kg',
      quantity: 250,
      location: 'Amreli'
    })
  ]);

  console.log('\nDemo data is ready.');
  console.log('Admin : admin@khedutconnect.demo / Admin@123');
  console.log('Buyer : buyer@khedutconnect.demo / Buyer@123');
  console.log('Farmers: farmer1@khedutconnect.demo, farmer2@khedutconnect.demo, farmer3@khedutconnect.demo / Farmer@123');
  console.log('\nDemo: Login as buyer and create Wheat, grains, kg, quantity 500.');
  console.log(`Created/updated users: ${admin.name}, ${buyer.name}, ${farmer1.name}, ${farmer2.name}, ${farmer3.name}`);
}

seed()
  .catch(err => {
    console.error('Demo seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
