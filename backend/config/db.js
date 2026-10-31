const mongoose = require('mongoose');

/**
 * Connect to MongoDB asynchronously using MONGODB_URI from environment variables.
 * Exits with status 1 if MONGODB_URI is not defined or if connection fails.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('Database connection error: MONGODB_URI is not defined in environment variables.');
    console.error('Please configure MONGODB_URI in backend/.env before starting the server.');
    process.exit(1);
  }

  try {
    // Normalize URI to prevent invalid namespace errors if double slash occurs before database name
    const normalizedUri = uri.trim().replace(/([^:])\/\/+/g, '$1/');
    const conn = await mongoose.connect(normalizedUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // Sanitize any potential URI credentials in error message
    const safeError = error.message
      ? error.message.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
      : 'Unknown database error';
    console.error(`Database connection error: ${safeError}`);
    process.exit(1);
  }
};

module.exports = connectDB;
