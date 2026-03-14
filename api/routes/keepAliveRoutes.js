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
    // Même en cas d'erreur, retourner 200 pour ne pas casser le flow
    return res.status(200).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint pour le service de monitoring (comme UptimeRobot)
// GET /api/keep-alive
// Pour économiser le compute Neon : ne pas appeler la DB à chaque ping.
// Ajouter ?check_db=1 pour inclure l'état DB (débogage).
router.get('/', async (req, res) => {
  const includeDbCheck = req.query.check_db === '1';
  // TOUJOURS retourner HTTP 200 pour UptimeRobot
  // Cette route doit être ultra-robuste et ne jamais retourner 500
  try {
    // Formatage du temps écoulé
    const formatUptime = (seconds) => {
      try {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
      } catch (err) {
        return 'N/A';
      }
    };
    
    // Formater la taille mémoire
    const formatMemory = (bytes) => {
      try {
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
      } catch (err) {
        return 'N/A';
      }
    };
    
    // Récupérer des informations de base sur le système (avec gestion d'erreur individuelle)
    let uptime = 0;
    let memoryUsage = {};
    let platform = {};
    
    try {
      uptime = process.uptime();
    } catch (err) {
      console.warn('[KEEP-ALIVE] Erreur lors de la récupération de uptime:', err.message);
    }
    
    try {
      memoryUsage = process.memoryUsage();
    } catch (err) {
      console.warn('[KEEP-ALIVE] Erreur lors de la récupération de memoryUsage:', err.message);
      memoryUsage = { rss: 0, heapTotal: 0, heapUsed: 0 };
    }
    
    try {
      platform = {
        node: process.version || 'unknown',
        platform: process.platform || 'unknown',
        arch: process.arch || 'unknown',
        cpus: (() => {
          try {
            return os.cpus().length;
          } catch (err) {
            return 0;
          }
        })()
      };
    } catch (err) {
      console.warn('[KEEP-ALIVE] Erreur lors de la récupération de platform:', err.message);
      platform = {
        node: process.version || 'unknown',
        platform: 'unknown',
        arch: 'unknown',
        cpus: 0
      };
    }
    
    // Vérifier l'état de la connexion PostgreSQL uniquement si demandé (?check_db=1)
    // Évite de consommer du compute Neon à chaque ping de monitoring (UptimeRobot, etc.)
    let dbStatus = {
      state: 'skipped',
      message: 'Ajouter ?check_db=1 à l\'URL pour vérifier la base'
    };
    if (includeDbCheck) {
      try {
        const sequelize = getSequelize();
        if (sequelize) {
          try {
            await Promise.race([
              sequelize.authenticate(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
            ]);
            dbStatus = { isConnected: true, state: 'connected' };
          } catch (authError) {
            dbStatus = {
              isConnected: false,
              state: 'disconnected',
              error: authError.message
            };
          }
        } else {
          dbStatus = { isConnected: false, state: 'no_instance' };
        }
      } catch (dbError) {
        console.warn('[KEEP-ALIVE] Erreur lors de la vérification de la DB:', dbError.message);
        dbStatus = {
          isConnected: false,
          state: 'error',
          error: dbError.message
        };
      }
    }
    
    // Renvoyer les informations (TOUJOURS HTTP 200)
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(uptime),
      uptimeRaw: uptime,
      memory: {
        rss: formatMemory(memoryUsage.rss || 0),
        heapTotal: formatMemory(memoryUsage.heapTotal || 0),
        heapUsed: formatMemory(memoryUsage.heapUsed || 0)
      },
      platform: platform,
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      isVercel: process.env.VERCEL === '1'
    });
  } catch (error) {
    // Même en cas d'erreur inattendue, TOUJOURS retourner HTTP 200
    console.error('[KEEP-ALIVE] Erreur inattendue:', error);
    return res.status(200).json({
      status: 'ok', // Toujours 'ok' même en cas d'erreur pour UptimeRobot
      timestamp: new Date().toISOString(),
      message: 'Service opérationnel',
      warning: error.message,
      environment: process.env.NODE_ENV || 'development',
      isVercel: process.env.VERCEL === '1'
    });
  }
});

module.exports = router; 