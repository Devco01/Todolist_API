const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { connectPostgres } = require('./config/postgres');
const { syncTodoModel } = require('./models/TodoPg');
const { initUserModel } = require('./models/UserPg');
const authService = require('./services/authService');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialiser l'application Express
const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173', 'https://todo-list-api-ys.vercel.app'],
  credentials: true,
  exposedHeaders: ['x-auth-token']
}));

// Initialisation des bases de données
const initDatabases = async () => {
  try {
    console.log('Initialisation des bases de données...');
    
    // Initialiser la connexion PostgreSQL
    const pgConnected = await connectPostgres();
    console.log('Connexion PostgreSQL:', pgConnected ? 'Réussie' : 'Échouée');
    
    if (pgConnected) {
      // Initialiser les modèles PostgreSQL
      console.log('Initialisation forcée du modèle User...');
      await initUserModel(true);
      
      // Forcer la synchronisation du modèle Todo pour s'assurer que la table est créée
      console.log('Initialisation et synchronisation forcée du modèle Todo...');
      const todoSynced = await syncTodoModel(true);
      console.log('Synchronisation du modèle Todo:', todoSynced ? 'Réussie' : 'Échouée');
      
      // Initialiser le service d'authentification
      await authService.initAuthService();
      console.log('Service d\'authentification initialisé avec succès');
    }
    
    // Initialiser la connexion MongoDB (si besoin)
    if (process.env.MONGODB_URI) {
      try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connexion MongoDB:', 'Réussie');
      } catch (mongoError) {
        console.error('Erreur de connexion MongoDB:', mongoError);
      }
    }
    
    console.log('Initialisation des bases de données terminée');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des bases de données:', error);
  }
};

// Routes
const todoRoutes = require('./routes/todoRoutes');
const todoPgRoutes = require('./routes/todoPgRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const notificationPgRoutes = require('./routes/notificationRoutesPg');
const keepAliveRoutes = require('./routes/keepAliveRoutes');

// API Routes
app.use('/api/todos', todoRoutes);
app.use('/api/todos', todoPgRoutes); // PostgreSQL - même endpoint
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notifications', notificationPgRoutes); // PostgreSQL - même endpoint
app.use('/api/keep-alive', keepAliveRoutes);

// Pour le déploiement Vercel
const PORT = process.env.PORT || 3000;

// Initialiser les bases de données avant de démarrer le serveur
initDatabases()
  .then(() => {
    // Démarrer le serveur Express
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Erreur lors de l\'initialisation:', error);
  });

// Export pour Vercel
module.exports = app; 