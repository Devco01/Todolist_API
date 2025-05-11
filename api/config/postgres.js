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
    console.log('[PG] Tentative de connexion à PostgreSQL...');
    
    // Récupérer les informations de connexion depuis les variables d'environnement
    const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!pgUrl) {
      console.error('[PG] Erreur: URL PostgreSQL non définie dans les variables d\'environnement');
      return false;
    }
    
    // Nettoyer et masquer l'URL pour la journalisation (ne pas afficher les identifiants)
    const maskedUrl = pgUrl.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
    console.log('[PG] URL de connexion PostgreSQL:', maskedUrl);
    
    // Options de connexion
    const options = {
      logging: (msg) => console.log('[PG-SQL]', msg),
      dialectOptions: {
        ssl: {
          require: process.env.NODE_ENV === 'production',
          rejectUnauthorized: false
        }
      }
    };
    
    // Créer une nouvelle instance Sequelize si elle n'existe pas déjà
    if (!sequelize) {
      sequelize = new Sequelize(pgUrl, options);
      console.log('[PG] Instance Sequelize créée');
    }
    
    // Vérifier la connexion
    await sequelize.authenticate();
    console.log('[PG] Connexion à PostgreSQL établie avec succès');
    
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
    
    // Tentative de reconnexion avec des options différentes
    try {
      if (process.env.POSTGRES_URL || process.env.DATABASE_URL) {
        console.log('[PG] Tentative de reconnexion sans SSL...');
        
        // Options sans SSL pour test
        sequelize = new Sequelize(process.env.POSTGRES_URL || process.env.DATABASE_URL, {
          logging: false,
          dialectOptions: {
            ssl: false
          }
        });
        
        await sequelize.authenticate();
        console.log('[PG] Reconnexion réussie sans SSL');
        return true;
      }
    } catch (retryError) {
      console.error('[PG] Échec de la tentative de reconnexion:', retryError.message);
    }
    
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