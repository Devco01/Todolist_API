const express = require('express');
const app = express();
const todoRoutes = require('./routes/todoRoutes');  // Chemin relatif correct

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// API routes
app.use('/api/todos', todoRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app; 