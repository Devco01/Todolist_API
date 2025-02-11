require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const allowCors = require('./api/cors');

// Ajout de cette ligne pour supprimer l'avertissement
mongoose.set('strictQuery', false);

const cors = require('cors');
const todoRoutes = require('./src/routes/todoRoutes');

const app = express();

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.log('MongoDB connecté');
}).catch(err => {
  console.error('Erreur MongoDB:', err);
});

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.get('/test', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/todos', todoRoutes);

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur' });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
  });
}

module.exports = app;

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
}); 