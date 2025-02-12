const express = require('express');
const connectDB = require('./config/db');
const app = express();

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
});

// Middleware
app.use(express.json());

// Routes
app.use('/api/todos', require('./routes/todoRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app; 