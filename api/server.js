const express = require('express');
const cors = require('cors');
const notificationService = require('./services/notificationServicePg');
const { connectPostgres } = require('./config/postgres');
const app = express();

// Connexion à PostgreSQL
(async () => {
  try {
    await connectPostgres();
    console.log('PostgreSQL connecté au démarrage');
  } catch (err) {
    console.error('Échec de la connexion à PostgreSQL:', err);
  }
})();

// Configuration CORS simplifiée pour autoriser toutes les origines
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

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

// Routes principales - redirection vers les routes PostgreSQL
app.use('/api/todos', require('./routes/todoPgRoutes'));

// Autres routes
app.use('/api/notifications', require('./routes/notificationRoutesPg'));
app.use('/api/keep-alive', require('./routes/keepAliveRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    postgresConnected: !!req.app.get('isPostgresConnected'),
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
    postgresConnected: !!req.app.get('isPostgresConnected'),
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
    message: 'API fonctionnelle avec Neon DB (PostgreSQL)',
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

// Route de diagnostic pour PostgreSQL
app.get('/api/debug-postgres', async (req, res) => {
  try {
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    res.json({
      urlConfigured: !!postgresUrl,
      urlLength: postgresUrl ? postgresUrl.length : 0,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      message: "Cette route permet de vérifier la configuration PostgreSQL"
    });
    
    console.log('DIAG: Route de diagnostic PostgreSQL appelée');
    console.log('DIAG: URL PostgreSQL configurée:', !!postgresUrl);
    
    // Tenter une connexion
    try {
      const connection = await connectPostgres();
      const isConnected = !!connection;
      
      console.log('DIAG: Tentative de connexion PostgreSQL:', isConnected ? 'Réussie' : 'Échouée');
      
      if (isConnected) {
        res.json({
          urlConfigured: !!postgresUrl,
          urlLength: postgresUrl ? postgresUrl.length : 0,
          connectionSuccess: true,
          env: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          message: "Connexion PostgreSQL réussie"
        });
      } else {
        res.json({
          urlConfigured: !!postgresUrl,
          urlLength: postgresUrl ? postgresUrl.length : 0,
          connectionSuccess: false,
          env: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          message: "Échec de connexion PostgreSQL, mais sans erreur"
        });
      }
    } catch (connectionError) {
      console.error('DIAG: Erreur de connexion PostgreSQL:', connectionError.message);
      
      res.status(500).json({
        urlConfigured: !!postgresUrl,
        urlLength: postgresUrl ? postgresUrl.length : 0,
        connectionSuccess: false,
        error: connectionError.message,
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        message: "Erreur lors de la connexion PostgreSQL"
      });
    }
  } catch (error) {
    console.error('DIAG: Erreur dans la route de diagnostic:', error);
    
    res.status(500).json({
      error: error.message,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      message: "Erreur lors de l'exécution de la route de diagnostic"
    });
  }
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