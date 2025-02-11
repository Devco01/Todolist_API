require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Ajout de cette ligne pour supprimer l'avertissement
mongoose.set('strictQuery', false);

const cors = require('cors');
const todoRoutes = require('./src/routes/todoRoutes');

const app = express();

// Middleware
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://todolistapi-production-0e04.up.railway.app',
    'https://votre-app.vercel.app',  // Le domaine fourni par Vercel
    'https://votre-app-git-main-username.vercel.app'  // Le domaine de preview
  ],
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

// Ajout d'un middleware de logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Connexion MongoDB avec plus de logs
mongoose.set('debug', true); // Active les logs MongoDB

const connectDB = async () => {
  try {
    console.log('Tentative de connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000 // Timeout après 5 secondes
    });
    console.log('MongoDB connecté avec succès');
  } catch (err) {
    console.error('Erreur détaillée de connexion MongoDB:', {
      message: err.message,
      code: err.code,
      name: err.name
    });
    process.exit(1);
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
app.get('/test', (req, res) => {
  res.json({ message: 'API fonctionnelle' });
});

app.use('/api/todos', todoRoutes);

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur globale:', err);
  res.status(500).json({
    message: 'Erreur serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
}); 