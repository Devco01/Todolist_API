const express = require('express');
const todoRoutes = require('./src/routes/todoRoutes');
const app = express();

// Middlewares
app.use(express.json());

// Simple root route
app.get('/', (req, res) => {
  res.send('API is running');
});

// API routes
app.use('/api/todos', todoRoutes);

// Handle 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

// Export for Vercel
module.exports = app; 