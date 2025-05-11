const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
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
app.use(cookieParser()); // Pour gérer les cookies d'authentification

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

// Routes d'authentification
app.use('/api/auth', require('./routes/authRoutes'));

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

// Endpoint pour le cron de Vercel spécifique à PostgreSQL
app.get('/api/cron/check-notifications-pg', require('./cron/check-notifications-pg'));

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

// Route de diagnostic avancée pour PostgreSQL
app.get('/api/debug-postgres-advanced', async (req, res) => {
  try {
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    // Masquer les informations sensibles pour l'affichage
    const maskedUrl = postgresUrl 
      ? postgresUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') 
      : null;
    
    // Informations sur la configuration
    const configInfo = {
      urlProvided: !!postgresUrl,
      urlLength: postgresUrl ? postgresUrl.length : 0,
      maskedUrl: maskedUrl,
      env: process.env.NODE_ENV,
      isVercel: process.env.VERCEL === '1',
      timestamp: new Date().toISOString()
    };
    
    let responseData = { ...configInfo };
    
    // Tentative de connexion avec capture de la trace complète
    try {
      console.log('[ADVANCED-DIAG] Tentative de connexion PostgreSQL avec URL:', maskedUrl);
      
      // Délai expiré après 10 secondes
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Délai de connexion expiré (10s)')), 10000);
      });
      
      // Tentative de connexion avec timeout
      const connection = await Promise.race([
        connectPostgres(),
        timeoutPromise
      ]);
      
      const isConnected = !!connection;
      console.log('[ADVANCED-DIAG] Tentative de connexion PostgreSQL:', isConnected ? 'Réussie' : 'Échouée');
      
      if (isConnected) {
        // Tester la connexion en exécutant une requête simple
        try {
          const testQuery = await connection.query('SELECT NOW() as current_time');
          const currentTime = testQuery?.rows?.[0]?.current_time || 'Unknown';
          
          responseData = {
            ...responseData,
            connectionSuccess: true,
            dbServerTime: currentTime,
            message: "Connexion PostgreSQL réussie avec requête test"
          };
        } catch (queryError) {
          responseData = {
            ...responseData,
            connectionSuccess: true,
            connectionQueryError: queryError.message,
            message: "Connexion établie mais erreur lors de la requête test"
          };
        }
      } else {
        responseData = {
          ...responseData,
          connectionSuccess: false,
          message: "Échec de connexion PostgreSQL, mais sans erreur spécifique"
        };
      }
    } catch (connectionError) {
      console.error('[ADVANCED-DIAG] Erreur de connexion PostgreSQL:', connectionError);
      
      // Analyser l'erreur pour des cas spécifiques
      let errorType = "unknown";
      let suggestion = "";
      
      const errorMsg = connectionError.message || '';
      
      if (errorMsg.includes('getaddrinfo ENOTFOUND')) {
        errorType = "host_not_found";
        suggestion = "L'hôte de la base de données n'a pas pu être résolu. Vérifiez l'URL.";
      } else if (errorMsg.includes('password authentication failed')) {
        errorType = "auth_failed";
        suggestion = "Échec d'authentification. Vérifiez les identifiants.";
      } else if (errorMsg.includes('Connection terminated')) {
        errorType = "connection_terminated";
        suggestion = "La connexion a été interrompue. Vérifiez le pare-feu/réseau.";
      } else if (errorMsg.includes('connect ETIMEDOUT')) {
        errorType = "timeout";
        suggestion = "Délai d'attente dépassé. Vérifiez l'accessibilité de la base de données.";
      } else if (errorMsg.includes('SSL connection')) {
        errorType = "ssl_error";
        suggestion = "Problème avec la connexion SSL. Vérifiez les paramètres SSL.";
      } else if (errorMsg.includes('Please install pg package manually')) {
        errorType = "missing_dependency";
        suggestion = "Le package 'pg' nécessaire pour PostgreSQL n'est pas installé. Installez-le avec 'npm install pg'.";
      }
      
      responseData = {
        ...responseData,
        connectionSuccess: false,
        error: connectionError.message,
        errorType,
        suggestion,
        stack: process.env.NODE_ENV === 'production' ? null : connectionError.stack,
        message: "Erreur lors de la connexion PostgreSQL"
      };
    }
    
    // Envoyer une seule réponse à la fin
    return res.status(responseData.connectionSuccess ? 200 : 500).json(responseData);
  } catch (error) {
    console.error('[ADVANCED-DIAG] Erreur dans la route de diagnostic:', error);
    
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      message: "Erreur lors de l'exécution de la route de diagnostic avancée"
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