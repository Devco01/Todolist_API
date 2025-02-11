require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const allowCors = require('./api/cors');

// Ajout de cette ligne pour supprimer l'avertissement
mongoose.set('strictQuery', false);

const cors = require('cors');
const todoRoutes = require('./src/routes/todoRoutes');

const app = express();

// Configuration CORS simplifiée
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');

  // Désactiver complètement les cookies
  res.setHeader('Set-Cookie', [
    '__vercel_live_token=; Path=/; SameSite=None; Secure; HttpOnly; Max-Age=0',
    'cookie=; Path=/; SameSite=None; Secure; HttpOnly; Max-Age=0'
  ]);

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

// Healthcheck endpoint simplifié
app.get('/test', (req, res) => {
  res.status(200).json({ status: 'ok' });
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

// Démarrage du serveur après connexion MongoDB
const startServer = () => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
};

// Connexion MongoDB puis démarrage serveur
connectDB().then(() => {
  startServer();
}).catch(err => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});

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

// Route par défaut pour le healthcheck
app.get('/', (req, res) => {
  res.json({ status: 'API is running' });
});

// Gestion des 404
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

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

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
}); 