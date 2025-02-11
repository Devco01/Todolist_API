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
  // Supprimer tous les cookies existants
  res.removeHeader('Set-Cookie');
  
  // Configuration CORS basique
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

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

// Route racine en premier
app.get('/', (req, res) => {
  res.json({
    status: 'TodoList API is running',
    endpoints: {
      todos: '/api/todos',
      health: '/test'
    }
  });
});

// Puis les routes API
app.use('/api/todos', todoRoutes);

// Puis le healthcheck
app.get('/test', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Gestion des 404 en dernier
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: ['/api/todos', '/test', '/']
  });
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