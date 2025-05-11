const express = require('express');
const router = express.Router();
const { getSequelize } = require('../config/postgres');
const os = require('os');
const authService = require('../services/authService');
const { protect } = require('../middleware/authMiddleware');

// Version sécurisée avec authentification
router.get('/secure', protect, (req, res) => {
  try {
    // L'utilisateur est authentifié ici (grâce au middleware protect)
    const { user } = req;
    
    // Renouveler le token
    const newToken = authService.generateToken(user);
    
    // Ajouter le nouveau token à l'en-tête de réponse
    res.setHeader('x-auth-token', newToken);
    
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Session maintenue active',
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Erreur dans le keep-alive sécurisé:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Endpoint pour le service de monitoring (comme UptimeRobot)
// GET /api/keep-alive
router.get('/', (req, res) => {
  try {
    // Récupérer des informations de base sur le système
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Vérifier l'état de la connexion PostgreSQL
    const sequelize = getSequelize();
    const dbStatus = {
      isConnected: sequelize ? true : false,
      state: sequelize ? 'connected' : 'disconnected'
    };
    
    // Formatage du temps écoulé
    const formatUptime = (seconds) => {
      const days = Math.floor(seconds / (3600 * 24));
      const hours = Math.floor((seconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    };
    
    // Formater la taille mémoire
    const formatMemory = (bytes) => {
      return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    };
    
    // Renvoyer les informations
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(uptime),
      uptimeRaw: uptime,
      memory: {
        rss: formatMemory(memoryUsage.rss),
        heapTotal: formatMemory(memoryUsage.heapTotal),
        heapUsed: formatMemory(memoryUsage.heapUsed)
      },
      platform: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length
      },
      database: {
        connected: dbStatus.isConnected,
        state: dbStatus.state
      },
      environment: process.env.NODE_ENV || 'development',
      isVercel: process.env.VERCEL === '1'
    });
  } catch (error) {
    // Même en cas d'erreur, renvoyer un statut 200 pour ne pas alerter le monitoring
    console.error('Erreur dans le keep-alive:', error);
    return res.status(200).json({
      status: 'warning',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router; 