const express = require('express');
const app = express();
const todoRoutes = require('./routes/todoRoutes');  // Chemin relatif correct

// Middleware
app.use(express.json());

// API routes
app.use('/api/todos', todoRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app; 