const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Instance Sequelize
let sequelize = null;

// Établir une connexion à PostgreSQL
const connectPostgres = async () => {
  try {
    console.log('[PG] Tentative de connexion à PostgreSQL via NeonDB...');
    
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
    
    // Options optimisées pour NeonDB
    const options = {
      logging: (msg) => console.log('[PG-SQL]', msg),
      dialect: 'postgres',
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false // Nécessaire pour NeonDB
        },
        keepAlive: true // Maintenir la connexion active
      },
      pool: {
        max: 10, // Maximum de connexions dans le pool
        min: 0, // Minimum de connexions dans le pool
        idle: 10000, // 10 secondes avant de libérer une connexion inactive
        acquire: 30000, // Délai d'attente max pour obtenir une connexion
        evict: 60000 // Intervalle de vérification des connexions inactives
      },
      retry: {
        max: 3 // Nombre de tentatives en cas d'échec
      }
    };
    
    // Créer une nouvelle instance Sequelize si elle n'existe pas déjà
    if (!sequelize) {
      sequelize = new Sequelize(pgUrl, options);
      console.log('[PG] Instance Sequelize créée pour NeonDB');
    }
    
    // Vérifier la connexion
    await sequelize.authenticate();
    console.log('[PG] Connexion à PostgreSQL (NeonDB) établie avec succès');
    
    // Vérifier les tables existantes
    try {
      const [results] = await sequelize.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      
      const tables = results.map(r => r.table_name);
      console.log('[PG] Tables existantes dans la base de données:', tables.join(', ') || 'Aucune');
    } catch (tableError) {
      console.error('[PG] Erreur lors de la vérification des tables:', tableError);
    }
    
    return true;
  } catch (error) {
    console.error('[PG] Erreur de connexion à PostgreSQL:', error);
    
    // Afficher des informations supplémentaires pour faciliter le débogage
    console.error('[PG] Détails de l\'erreur:', error.original || error.parent || 'Pas de détails disponibles');
    
    if (error.name === 'SequelizeConnectionError') {
      console.error('[PG] Problème de connexion - Vérifiez l\'URL et les identifiants');
    }
    
    if (error.name === 'SequelizeHostNotFoundError') {
      console.error('[PG] Hôte non trouvé - Vérifiez l\'URL et la connectivité réseau');
    }
    
    if (error.name === 'SequelizeConnectionRefusedError') {
      console.error('[PG] Connexion refusée - Vérifiez que le serveur PostgreSQL est bien démarré');
    }
    
    console.log('[PG] Vérifiez les points suivants pour NeonDB:');
    console.log('1. L\'URL de connexion est correctement formatée');
    console.log('2. Le projet et la base de données existent sur NeonDB');
    console.log('3. Les identifiants sont corrects');
    console.log('4. La connexion depuis l\'environnement actuel est autorisée');
    
    return false;
  }
};

// Récupérer l'instance Sequelize
const getSequelize = () => {
  return sequelize;
};

module.exports = {
  connectPostgres,
  getSequelize
}; 