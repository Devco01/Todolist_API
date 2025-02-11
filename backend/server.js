require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const allowCors = require('./api/cors');

// Ajout de cette ligne pour supprimer l'avertissement
mongoose.set('strictQuery', false);

const cors = require('cors');
const todoRoutes = require('./src/routes/todoRoutes');

const app = express();

// Middleware CORS avant tout
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // ou plus spécifiquement :
  // res.setHeader('Access-Control-Allow-Origin', 'https://todolist-17q1wd367-devco01s-projects.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Gérer les requêtes OPTIONS préliminaires
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Puis les autres middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion MongoDB avec plus de logs
mongoose.set('debug', true); // Active les logs MongoDB

// Healthcheck endpoint
app.get('/test', (req, res) => {
  try {
    // Vérifier la connexion MongoDB
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        status: 'error',
        message: 'Database not connected',
        readyState: mongoose.connection.readyState
      });
    }
    
    res.status(200).json({ 
      status: 'ok',
      message: 'API fonctionnelle',
      dbStatus: 'connected'
    });
  } catch (error) {
    console.error('Healthcheck error:', error);
    res.status(500).json({ 
      status: 'error',
      message: error.message 
    });
  }
});

// Améliorer la gestion de la connexion MongoDB
const connectDB = async () => {
  try {
    console.log('Tentative de connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Augmenter le timeout
      heartbeatFrequencyMS: 2000,      // Vérifier plus fréquemment
      retryWrites: true,
      w: 'majority'
    });
    console.log('MongoDB connecté avec succès');
  } catch (err) {
    console.error('Erreur de connexion MongoDB:', err);
    // Ne pas quitter le processus, permettre les retries
    setTimeout(connectDB, 5000);
  }
};

connectDB();

// Ajout de plus de listeners d'événements
mongoose.connection.on('connecting', () => {
  console.log('Tentative de connexion à MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('Mongoose connecté à MongoDB');
});

mongoose.connection.on('error', err => {
  console.error('Erreur de connexion Mongoose:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose déconnecté de MongoDB');
});

// Routes
app.use('/api/todos', todoRoutes);

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Envelopper l'application avec le middleware CORS
const handler = (req, res) => {
  app(req, res);
};

module.exports = allowCors(handler);

// Garder l'écoute du port uniquement en développement
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
}); 