const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const notificationService = require('./services/notificationService');
const app = express();

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  // Ne pas quitter le processus pour permettre au serveur de fonctionner même sans base de données
  // process.exit(1);
});

// Configuration CORS simplifiée pour autoriser toutes les origines
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Une erreur est survenue sur le serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Routes
app.use('/api/todos', require('./routes/todoRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Initialiser le service de notification
if (process.env.NODE_ENV !== 'test') {
  notificationService.initNotificationService();
}

module.exports = app; 