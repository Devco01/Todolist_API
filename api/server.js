const express = require('express');
const { connectDB } = require('./config/db');
const cors = require('cors');
const notificationService = require('./services/notificationService');
const app = express();

// Connect to MongoDB
connectDB().catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  // Ne pas quitter le processus pour permettre au serveur de fonctionner même sans base de données
  // process.exit(1);
});

// Configuration CORS simplifiée pour autoriser toutes les origines
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

// Middleware pour vérifier l'état de la connexion MongoDB
app.use((req, res, next) => {
  // Ajouter l'information de connexion MongoDB à la réponse
  res.locals.isMongoConnected = req.app.get('isMongoConnected') || false;
  next();
});

// Stocker l'application dans une variable globale
// Utile pour les fonctions qui ont besoin d'accéder à l'application
global.app = app;

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
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/keep-alive', require('./routes/keepAliveRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    mongoConnected: res.locals.isMongoConnected,
    timestamp: new Date().toISOString(),
    vercel: process.env.VERCEL === '1'
  });
});

// Informations sur le système
app.get('/api/system-info', (req, res) => {
  res.status(200).json({
    version: process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'development',
    mongoConnected: res.locals.isMongoConnected,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    vercel: process.env.VERCEL === '1'
  });
});

// Endpoint pour le cron de Vercel - permet de vérifier les notifications
// Cette route est appelée par le cron défini dans vercel.json
app.get('/api/cron/check-notifications', async (req, res) => {
  try {
    // Vérification du token de sécurité (si configuré)
    // Pour les appels via Vercel Cron, ce token est facultatif
    // mais peut être utile si vous appelez aussi cet endpoint manuellement
    const configToken = process.env.NOTIFICATION_CHECK_TOKEN;
    const requestToken = req.query.token;
    
    // Si utilisé en dehors de Vercel Cron et qu'un token est configuré
    if (!process.env.VERCEL && configToken && configToken.length > 0) {
      if (!requestToken || requestToken !== configToken) {
        return res.status(401).json({
          success: false,
          message: 'Token de sécurité invalide ou manquant'
        });
      }
    }
    
    console.log('Cron API: Vérification des notifications déclenchée');
    await notificationService.checkTasksForNotification();
    const result = await notificationService.sendPendingNotifications();
    
    res.status(200).json({
      success: true,
      message: 'Vérification des notifications terminée avec succès',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Erreur lors de la vérification des notifications via cron API:', error);
    
    // Même en cas d'erreur, retourner 200 pour que Vercel ne considère pas le cron comme échoué
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Ajouter une route pour la racine - utile pour Vercel et pour tester que l'API fonctionne
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TodoList API',
    version: process.env.npm_package_version || '1.0.0',
    status: 'online',
    message: 'API fonctionnelle',
    documentation: {
      endpoints: {
        todos: '/api/todos',
        notifications: '/api/notifications',
        health: '/api/health',
        systemInfo: '/api/system-info',
        keepAlive: '/api/keep-alive'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Initialiser le service de notification
// Sur Vercel, le service sera activé mais le cron est géré par Vercel
if (process.env.NODE_ENV !== 'test') {
  notificationService.initNotificationService();
}

module.exports = app; 