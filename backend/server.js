const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const frontendRoot = path.join(__dirname, '..');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  next();
});

const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

app.use('/api/ai', require('./routes/ai'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/bulk-orders', require('./routes/bulkOrders'));
app.use('/api/chat', require('./routes/chat'));

app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const database = process.env.SKIP_DB === 'true'
    ? 'skipped'
    : states[mongoose.connection.readyState] || 'unknown';
  const healthy = database === 'connected';

  return res.status(healthy ? 200 : 503).json({
    service: 'KhedutConnect API',
    version: '3.0.0',
    status: healthy ? 'healthy' : 'degraded',
    database,
    features: {
      secureAdminSetup: true,
      productPhotos: true,
      directOrders: true,
      multiFarmerFulfillment: true,
      chatContacts: true,
      equipmentBookings: true
    },
    timestamp: new Date().toISOString()
  });
});

app.use(express.static(frontendRoot, {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

app.get('/', (req, res) => {
  return res.sendFile(path.join(frontendRoot, 'index.html'));
});

app.use('/api', (req, res) => {
  return res.status(404).json({ message: 'API route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled request error:', err.message);
  if (res.headersSent) return next(err);
  return res.status(err.message === 'Origin not allowed' ? 403 : 500).json({
    message: err.message === 'Origin not allowed' ? err.message : 'Unexpected server error'
  });
});

async function connectDatabase() {
  if (process.env.SKIP_DB === 'true') {
    console.log('ℹ️ MongoDB connection skipped (SKIP_DB=true)');
    return false;
  }
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is missing in backend/.env');
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10_000 });
    console.log('✅ MongoDB Connected!');
    return true;
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`);
    return false;
  }
}

function startServer() {
  const PORT = Number(process.env.PORT) || 5000;
  const server = app.listen(PORT, () => {
    console.log(`🚀 KhedutConnect running at http://localhost:${PORT}`);
  });

  connectDatabase();

  const shutdown = async signal => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  return server;
}

if (require.main === module) startServer();

module.exports = { app, startServer, connectDatabase };
