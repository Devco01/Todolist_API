const express = require('express');
const router = express.Router();
const { checkConnection } = require('../config/db');
const os = require('os');

// Endpoint pour le service de monitoring (comme UptimeRobot)
// GET /api/keep-alive
router.get('/', (req, res) => {
  try {
    // Récupérer des informations de base sur le système
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const dbStatus = checkConnection();
    
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