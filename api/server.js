const express = require('express');
const connectDB = require('./config/db');
const app = express();

// Connect to MongoDB
let dbError = null;
connectDB().catch(err => {
  dbError = err;
  console.error('Failed to connect to MongoDB:', err);
});

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour les logs
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - body:`, req.body);
  if (dbError) {
    console.error('DB Error:', dbError);
    return res.status(500).json({ error: 'Database connection error' });
  }
  next();
});

// Debug route
app.get('/api/debug', (req, res) => {
  res.json({
    env: {
      NODE_ENV: process.env.NODE_ENV,
      MONGODB_URI: process.env.MONGODB_URI ? 'Set' : 'Not set'
    },
    mongodb: {
      readyState: require('mongoose').connection.readyState,
      error: dbError ? {
        message: dbError.message,
        code: dbError.code
      } : null
    }
  });
});

// Routes
app.use('/api/todos', require('./routes/todoRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    db: dbError ? 'error' : 'connected'
  });
});

module.exports = app; 