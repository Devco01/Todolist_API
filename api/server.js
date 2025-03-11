const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const app = express();

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  // Ne pas quitter le processus pour permettre au serveur de fonctionner même sans base de données
  // process.exit(1);
});

// Configuration CORS plus permissive
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (comme les appels d'API mobiles ou curl)
    if (!origin) return callback(null, true);
    
    // Liste des origines autorisées
    const allowedOrigins = [
      // Origines de développement local
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      // Origines de production (Vercel)
      'https://todolist-api-devco01.vercel.app',
      'https://todolist-api-git-main-devco01.vercel.app',
      'https://todolist-api.vercel.app'
    ];
    
    // Vérifier si l'origine est autorisée
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('CORS non autorisé pour cette origine'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));

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

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

module.exports = app; 