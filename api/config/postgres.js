const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Instance Sequelize - SINGLETON GLOBAL
let sequelize = null;
let isConnecting = false; // Flag pour éviter les connexions simultanées
let connectionPromise = null; // Promise partagée pour éviter les doubles connexions
let lastConnectionAttempt = 0; // Timestamp de la dernière tentative
let connectionRetryCount = 0; // Compteur de tentatives pour éviter les boucles infinies
const MIN_RETRY_DELAY = 60000; // Minimum 1 minute entre les tentatives de reconnexion
const MAX_RETRY_COUNT = 3; // Maximum 3 tentatives avant d'abandonner

// Établir une connexion à PostgreSQL avec protection contre les reconnexions en boucle
const connectPostgres = async (force = false) => {
  // CRITIQUE: Si une connexion est déjà en cours, attendre celle-ci
  if (connectionPromise && !force) {
    console.log('[PG] Connexion déjà en cours, réutilisation...');
    return await connectionPromise;
  }
  
  // CRITIQUE: Vérifier si une connexion valide existe déjà
  if (sequelize && !force) {
    try {
      await sequelize.authenticate();
      console.log('[PG] Réutilisation de la connexion existante');
      return true;
    } catch (err) {
      console.warn('[PG] Connexion existante invalide, reconnexion nécessaire...');
      sequelize = null;
    }
  }
  
  // CRITIQUE: Protection contre les reconnexions en boucle
  const now = Date.now();
  if (!force && connectionRetryCount >= MAX_RETRY_COUNT) {
    const timeSinceLastAttempt = now - lastConnectionAttempt;
    if (timeSinceLastAttempt < MIN_RETRY_DELAY) {
      const waitTime = Math.ceil((MIN_RETRY_DELAY - timeSinceLastAttempt) / 1000);
      console.warn(`[PG] Trop de tentatives récentes (${connectionRetryCount}/${MAX_RETRY_COUNT}). Attente de ${waitTime}s avant nouvelle tentative...`);
      return false;
    } else {
      // Réinitialiser le compteur après le délai
      connectionRetryCount = 0;
    }
  }
  
  // Marquer qu'une connexion est en cours
  isConnecting = true;
  lastConnectionAttempt = now;
  connectionRetryCount++;
  
  // Créer une Promise partagée pour éviter les doubles connexions
  connectionPromise = (async () => {
    try {
      console.log(`[PG] Tentative de connexion #${connectionRetryCount} à PostgreSQL via NeonDB...`);
      
      // Récupérer les informations de connexion depuis les variables d'environnement
      // Vercel définit automatiquement POSTGRES_URL et DATABASE_URL
      const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
      
      if (!pgUrl) {
        console.error('[PG] Erreur: URL PostgreSQL non définie dans les variables d\'environnement');
        return false;
      }
      
      // Nettoyer et masquer l'URL pour la journalisation (ne pas afficher les identifiants)
      const maskedUrl = pgUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
      console.log('[PG] URL de connexion PostgreSQL (masquée):', maskedUrl);
      
      // Options optimisées pour NeonDB (serverless/postgres compatible)
      const options = {
      logging: (msg) => {
        // Réduire les logs en production pour éviter la pollution
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_DB === 'true') {
          console.log('[PG-SQL]', msg);
        }
      },
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // Nécessaire pour NeonDB
        },
        // Options spécifiques pour NeonDB serverless
        application_name: 'todolist-api',
        connect_timeout: 3, // Timeout de connexion réduit à 3 secondes pour Vercel (limite 10s)
        keepAlive: true, // Maintenir la connexion active
        // Support pour les connexions serverless de NeonDB
        statement_timeout: 5000 // Timeout de requête réduit à 5 secondes pour éviter les timeouts Vercel
      },
      pool: {
        max: 1, // IMPORTANT: NeonDB serverless fonctionne mieux avec max: 1
        min: 0,
        idle: 10000, // 10 secondes avant de libérer une connexion inactive
        acquire: 3000, // Délai d'attente max réduit à 3s pour éviter les timeouts Vercel
        evict: 60000, // Intervalle de vérification des connexions inactives
        // Gestion spéciale pour les connexions serverless
        handleDisconnects: true,
        // Retry automatique en cas de déconnexion
        validate: async (client) => {
          try {
            await client.query('SELECT 1');
            return true;
          } catch (error) {
            console.error('[PG] Validation de connexion échouée:', error.message);
            return false;
          }
        }
      },
      // IMPORTANT: Désactiver le retry automatique de Sequelize pour éviter les boucles
      // On gère nous-mêmes les retries avec un système de rate limiting
      retry: {
        max: 0 // Pas de retry automatique - on gère manuellement
      },
      // Timeout global pour toutes les opérations - réduit pour Vercel (limite 10s)
      timeout: 5000,
      // Options spécifiques NeonDB
      define: {
        freezeTableName: true,
        underscored: false
      }
    };
      
      // Créer une nouvelle instance Sequelize si elle n'existe pas déjà
      if (!sequelize || force) {
        // Fermer l'ancienne connexion si elle existe
        if (sequelize) {
          try {
            await sequelize.close();
            console.log('[PG] Ancienne connexion fermée');
          } catch (closeError) {
            console.warn('[PG] Erreur lors de la fermeture de l\'ancienne connexion:', closeError.message);
          }
        }
        
        sequelize = new Sequelize(pgUrl, options);
        console.log('[PG] Instance Sequelize créée pour NeonDB');
        
        // Gestionnaire d'événements pour les erreurs de connexion (sans recréation automatique)
        sequelize.connectionManager.pool.on('error', (err) => {
          console.error('[PG] Erreur dans le pool de connexions:', err.message);
          // NE PAS réinitialiser automatiquement pour éviter les boucles
        });
      }
      
      // Vérifier la connexion (UNIQUEMENT UNE FOIS, pas de retry en boucle)
      try {
        await sequelize.authenticate();
        console.log('[PG] Connexion à PostgreSQL (NeonDB) établie avec succès');
        
        // Réinitialiser le compteur de retry en cas de succès
        connectionRetryCount = 0;
        
      } catch (authError) {
        console.error('[PG] Échec de l\'authentification:', authError.message);
        // Ne pas réessayer immédiatement - laisser le rate limiting gérer
        throw authError;
      }
    
      // Vérifier les tables existantes (optionnel, seulement si pas en mode erreur)
      try {
        const [results] = await sequelize.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        
        const tables = results.map(r => r.table_name);
        console.log('[PG] Tables existantes dans la base de données:', tables.join(', ') || 'Aucune');
      } catch (tableError) {
        // Ne pas bloquer en cas d'erreur de vérification des tables
        console.warn('[PG] Erreur lors de la vérification des tables (non bloquant):', tableError.message);
      }
      
      return true;
      
    } catch (error) {
      console.error('[PG] Erreur de connexion à PostgreSQL:', error.message);
      
      // Afficher des informations supplémentaires pour faciliter le débogage
      if (process.env.DEBUG_DB === 'true') {
        console.error('[PG] Détails de l\'erreur:', error.original || error.parent || 'Pas de détails disponibles');
        console.error('[PG] Stack:', error.stack);
      }
      
      if (error.name === 'SequelizeConnectionError') {
        console.error('[PG] Problème de connexion - Vérifiez l\'URL et les identifiants');
      }
      
      if (error.name === 'SequelizeHostNotFoundError') {
        console.error('[PG] Hôte non trouvé - Vérifiez l\'URL et la connectivité réseau');
      }
      
      if (error.name === 'SequelizeConnectionRefusedError') {
        console.error('[PG] Connexion refusée - Vérifiez que le serveur PostgreSQL est bien démarré');
      }
      
      // Ne pas logger toutes les vérifications en production pour éviter la pollution
      if (connectionRetryCount >= MAX_RETRY_COUNT) {
        console.warn('[PG] ⚠️ LIMITE DE TENTATIVES ATTEINTE - Arrêt des reconnexions pour éviter d\'épuiser NeonDB');
        console.warn('[PG] La connexion sera réessayée après un délai minimum');
        console.log('[PG] Vérifiez les points suivants pour NeonDB:');
        console.log('1. L\'URL de connexion est correctement formatée');
        console.log('2. Le projet et la base de données existent sur NeonDB');
        console.log('3. Les identifiants sont corrects');
        console.log('4. La connexion depuis l\'environnement actuel est autorisée');
        console.log('5. Votre plan NeonDB n\'a pas atteint ses limites');
      }
      
      return false;
    } finally {
      // Réinitialiser les flags
      isConnecting = false;
      connectionPromise = null;
    }
  })();
  
  return await connectionPromise;
};

// Récupérer l'instance Sequelize (sans créer de connexion)
// IMPORTANT: Cette fonction ne crée PAS de nouvelle connexion, elle retourne juste l'instance existante
const getSequelize = () => {
  return sequelize;
};

// Fonction pour vérifier si une connexion est active sans créer de nouvelle connexion
const isConnected = async () => {
  if (!sequelize) {
    return false;
  }
  
  try {
    await sequelize.authenticate();
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  connectPostgres,
  getSequelize,
  isConnected
}; 