const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const verificationRoutes = require('./routes/verification');

// Load environment variables reliably from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Express JSON parsing middleware
app.use(express.json());

// CORS configuration for Angular frontend origin
app.use(
  cors({
    origin: 'http://localhost:4200',
    credentials: true,
  })
);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const dbState = mongoose.connection.readyState;

  res.status(200).json({
    success: true,
    message: 'UEM Admission System Backend is running successfully',
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: dbState === 1,
    },
    timestamp: new Date().toISOString(),
  });
});

// Configure port via process.env.PORT or default to 5000
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB before accepting requests
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    return server;
  } catch (error) {
    const safeError = error.message
      ? error.message.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
      : 'Failed to initialize server';
    console.error(`Server initialization error: ${safeError}`);
    process.exit(1);
  }
};

startServer();

module.exports = { app, startServer };
