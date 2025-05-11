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
    console.log('Initialisation du modèle User...');
    await initUserModel(true);
    
    // Synchroniser le modèle Todo uniquement si PostgreSQL est connecté
    if (pgConnected) {
      console.log('Initialisation et synchronisation du modèle Todo...');
      const todoSynced = await syncTodoModel(true);
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