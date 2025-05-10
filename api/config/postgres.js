const { Sequelize } = require('sequelize');
const config = require('./config');

// Variable pour stocker l'instance Sequelize
let sequelize = null;

// Fonction pour se connecter à PostgreSQL
const connectPostgres = async () => {
  try {
    // Si déjà connecté, retourner l'instance existante
    if (sequelize) {
      return sequelize;
    }

    // Récupérer l'URL de connexion depuis les variables d'environnement
    const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!postgresUrl) {
      console.warn('Aucune URL PostgreSQL définie, utilisation du stockage en mémoire uniquement');
      return null;
    }
    
    console.log('Tentative de connexion à PostgreSQL...');
    
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
    await sequelize.authenticate();
    
    console.log('PostgreSQL connecté avec succès');
    
    // Mettre l'application globale au courant de la connexion
    if (global.app) {
      global.app.set('isPostgresConnected', true);
    }
    
    return sequelize;
  } catch (error) {
    console.error('Erreur de connexion à PostgreSQL:', error.message);
    
    // Si on est sur Vercel, on peut continuer sans Postgres
    if (process.env.VERCEL === '1') {
      console.log('Exécution sur Vercel, poursuite sans PostgreSQL');
    }
    
    // En mode développement, on peut fonctionner sans base de données
    if (process.env.NODE_ENV !== 'production') {
      console.log('Mode développement : l\'application utilisera le stockage en mémoire');
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