const express = require('express');
const todoRoutes = require('./src/routes/todoRoutes');
const app = express();

// Basic middleware
app.use(express.json());

// Health check - le plus simple possible
app.get('/test', (req, res) => res.sendStatus(200));

// Routes
app.get('/', (req, res) => res.send('API is running'));
app.use('/api/todos', todoRoutes);

// Export for Vercel
module.exports = app; 