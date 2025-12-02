const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { connectPostgres } = require('./config/postgres');
const { syncTodoModel } = require('./models/TodoPg');
const { initUserModel } = require('./models/UserPg');
const authService = require('./services/authService');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Définir des variables d'environnement par défaut si non présentes
if (!process.env.ALLOW_INVALID_USERS) {
  process.env.ALLOW_INVALID_USERS = 'true';
  console.log('Mode de tolérance des utilisateurs invalides activé par défaut');
}

if (!process.env.ALLOW_TOKEN_FALLBACK) {
  process.env.ALLOW_TOKEN_FALLBACK = 'true';
  console.log('Mode de récupération par token activé par défaut');
}

if (!process.env.ALLOW_ANONYMOUS_TODOS) {
  process.env.ALLOW_ANONYMOUS_TODOS = 'true';
  console.log('Mode de création de tâches anonymes activé par défaut');
}

// Activer automatiquement le mode mémoire si nécessaire
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log('Aucune URL PostgreSQL trouvée. Activation du mode mémoire.');
  process.env.USE_MEMORY_MODE = 'true';
}

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
    
    // Initialiser la connexion PostgreSQL si le mode mémoire n'est pas activé
    let pgConnected = false;
    if (process.env.USE_MEMORY_MODE !== 'true') {
      pgConnected = await connectPostgres();
      console.log('Connexion PostgreSQL:', pgConnected ? 'Réussie' : 'Échouée');
      
      // Activer le mode mémoire si la connexion PostgreSQL a échoué
      if (!pgConnected) {
        console.log('Activation du mode mémoire suite à l\'échec de connexion PostgreSQL');
        process.env.USE_MEMORY_MODE = 'true';
      }
    } else {
      console.log('Mode mémoire activé, connexion PostgreSQL ignorée');
    }
    
    // Initialiser les modèles (avec ou sans mode mémoire)
    // CRITIQUE: Ne JAMAIS utiliser force=true en production pour éviter la perte de données !
    console.log('Initialisation du modèle User...');
    const forceUserSync = process.env.FORCE_SYNC === 'true' && process.env.NODE_ENV !== 'production';
    
    // OPTIMISATION: Timeout très court pour éviter les timeouts Vercel (10s max)
    try {
      await Promise.race([
        initUserModel(forceUserSync),
        new Promise((resolve) => setTimeout(() => {
          console.warn('Initialisation User timeout - continuation en mode mémoire');
          resolve(false);
        }, 2000)) // Max 2 secondes pour l'initialisation
      ]);
    } catch (userInitError) {
      console.error('Erreur lors de l\'initialisation du modèle User (non bloquant):', userInitError.message);
      // Ne pas bloquer, continuer en mode mémoire
    }
    
    // Synchroniser le modèle Todo uniquement si PostgreSQL est connecté
    if (pgConnected) {
      console.log('Initialisation et synchronisation du modèle Todo...');
      // CRITIQUE: Ne JAMAIS utiliser force=true en production pour éviter la perte de données !
      const forceTodoSync = process.env.FORCE_SYNC === 'true' && process.env.NODE_ENV !== 'production';
      const todoSynced = await syncTodoModel(forceTodoSync);
      console.log('Synchronisation du modèle Todo:', todoSynced ? 'Réussie' : 'Échouée');
    }
    
    // Initialiser le service d'authentification
    await authService.initAuthService();
    console.log('Service d\'authentification initialisé avec succès');
    
    console.log('Initialisation des bases de données terminée');
    console.log('Mode de fonctionnement:', process.env.USE_MEMORY_MODE === 'true' ? 'MÉMOIRE' : 'BASE DE DONNÉES');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des bases de données:', error);
  }
};

// Routes
const todoPgRoutes = require('./routes/todoPgRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationPgRoutes = require('./routes/notificationRoutesPg');
const keepAliveRoutes = require('./routes/keepAliveRoutes');

// API Routes
app.use('/api/todos', todoPgRoutes); // PostgreSQL
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationPgRoutes); // PostgreSQL
app.use('/api/keep-alive', keepAliveRoutes);

// Middleware de gestion d'erreur global - DOIT être après toutes les routes
app.use((err, req, res, next) => {
  console.error('=== ERREUR GLOBALE ATTRAPÉE ===');
  console.error('URL:', req.url);
  console.error('Method:', req.method);
  console.error('Error name:', err.name);
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('================================');
  
  // Ne pas renvoyer 500 pour les erreurs de connexion DB
  if (err.name === 'SequelizeConnectionError' || 
      err.name === 'SequelizeConnectionRefusedError' ||
      err.message?.includes('connection') ||
      err.message?.includes('Connection') ||
      err.message?.includes('non disponible')) {
    return res.status(503).json({
      success: false,
      error: 'Service temporairement indisponible',
      message: 'La base de données n\'est pas accessible pour le moment. Veuillez réessayer dans quelques instants.',
      dbAvailable: false
    });
  }
  
  // Par défaut, retourner 500
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur inattendue s\'est produite',
    errorType: err.name || 'UnknownError'
  });
});

// 404 handler - DOIT être le dernier
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route non trouvée',
    path: req.path
  });
});

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