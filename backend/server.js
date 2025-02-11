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

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});

app.use('/api/todos', todoRoutes);

// Export pour Vercel
module.exports = app;

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
}); 