const express = require('express');
const todoRoutes = require('./src/routes/todoRoutes');
const app = express();

// Middlewares
app.use(express.json());

// Test route for healthcheck
app.get('/test', (req, res) => {
  res.status(200).send('ok');  // Réponse la plus simple possible
});

// API routes
app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

app.use('/api/todos', todoRoutes);

// Export for Vercel
module.exports = app; 