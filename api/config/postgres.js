const { Sequelize } = require('sequelize');
const config = require('./config');

// Variable pour stocker l'instance Sequelize
let sequelize = null;

// Fonction pour se connecter à PostgreSQL
const connectPostgres = async () => {
  try {
    console.log('[POSTGRES] Démarrage du processus de connexion à PostgreSQL');
    
    // Vérifier si le package pg est installé
    try {
      require('pg');
      console.log('[POSTGRES] Package pg trouvé et chargé avec succès');
    } catch (pgError) {
      console.error('[POSTGRES] Erreur lors du chargement du package pg:', pgError.message);
      console.error('[POSTGRES] Tentative d\'installation automatique du package pg...');
      
      // Sur Vercel, on ne peut pas installer dynamiquement
      if (process.env.VERCEL === '1') {
        console.error('[POSTGRES] Environnement Vercel détecté. Installation dynamique impossible.');
        console.error('[POSTGRES] Veuillez ajouter pg aux dépendances et redéployer l\'application.');
        return null;
      }
      
      // On pourrait tenter d'installer dynamiquement mais c'est risqué
      return null;
    }

    // Si déjà connecté, retourner l'instance existante
    if (sequelize) {
      console.log('[POSTGRES] Connexion existante réutilisée');
      return sequelize;
    }

    // Récupérer l'URL de connexion depuis les variables d'environnement
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!postgresUrl) {
      console.warn('[POSTGRES] Aucune URL PostgreSQL définie, utilisation du stockage en mémoire uniquement');
      console.log('[POSTGRES] Variables d\'environnement disponibles:', Object.keys(process.env).filter(key => 
        key.includes('DB') || key.includes('SQL') || key.includes('POSTGRES')));
      return null;
    }
    
    console.log('[POSTGRES] URL PostgreSQL trouvée, tentative de connexion...');
    console.log('[POSTGRES] Format de l\'URL:', postgresUrl.split('@')[0].replace(/:[^:]*@/, ':***@'));
    
    // Options SSL pour Neon
    const dialectOptions = {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    };

    // Créer une nouvelle instance Sequelize
    sequelize = new Sequelize(postgresUrl, {
      dialect: 'postgres',
      dialectOptions,
      logging: process.env.NODE_ENV === 'development',
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
    
    // Tester la connexion
    console.log('[POSTGRES] Instance Sequelize créée, test de la connexion...');
    await sequelize.authenticate();
    
    console.log('[POSTGRES] PostgreSQL connecté avec succès');
    
    // Mettre l'application globale au courant de la connexion
    if (global.app) {
      global.app.set('isPostgresConnected', true);
    }
    
    return sequelize;
  } catch (error) {
    console.error('[POSTGRES] Erreur de connexion à PostgreSQL:', error.message);
    console.error('[POSTGRES] Détails supplémentaires:', error);
    
    // Si on est sur Vercel, on peut continuer sans Postgres
    if (process.env.VERCEL === '1') {
      console.log('[POSTGRES] Exécution sur Vercel, poursuite sans PostgreSQL');
    }
    
    // En mode développement, on peut fonctionner sans base de données
    if (process.env.NODE_ENV !== 'production') {
      console.log('[POSTGRES] Mode développement : l\'application utilisera le stockage en mémoire');
    }
    
    // Mettre l'application globale au courant de la connexion
    if (global.app) {
      global.app.set('isPostgresConnected', false);
    }
    
    return null;
  }
};

// Fonction pour obtenir l'instance Sequelize
const getSequelize = () => sequelize;

// Exporter les fonctions et l'instance
module.exports = {
  connectPostgres,
  getSequelize
}; 