const express = require('express');
const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Middleware pour les logs
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - body:`, req.body);
  next();
});

// Routes
app.use('/api/todos', require('./routes/todoRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = app; 