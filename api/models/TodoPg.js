const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/postgres');
const { getUserModel } = require('./UserPg');

// Définition du modèle Todo pour PostgreSQL avec Sequelize
const defineTodoModel = () => {
  const sequelize = getSequelize();
  
  // Si pas de connexion Sequelize, ne pas définir le modèle
  if (!sequelize) {
    console.log('[TODOPG] Pas de connexion Sequelize disponible');
    return null;
  }
  
  console.log('[TODOPG] Définition du modèle Todo');
  
  // Définir le modèle
  const Todo = sequelize.define('Todo', {
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    dueTime: {
      type: DataTypes.STRING,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'autre',
      validate: {
        isIn: [['maison', 'courses', 'santé', 'travail', 'famille', 'autre']]
      }
    },
    priority: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'medium',
      validate: {
        isIn: [['low', 'medium', 'high']]
      }
    },
    completed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notificationEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmailIfNotificationsEnabled(value) {
          // Validation conditionnelle : vérifier l'email seulement si les notifications sont activées
          if (this.notificationsEnabled && value) {
            if (!/\S+@\S+\.\S+/.test(value)) {
              throw new Error('L\'adresse email n\'est pas valide');
            }
          }
          // Si notifications désactivées, pas de validation d'email nécessaire
        }
      }
    },
    notificationsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notificationSent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true, // On permet null pour les anciennes tâches
      references: {
        model: 'User', // Nom exact de la table User (corrigé)
        key: 'id'
      },
      validate: {
        isValidUUID(value) {
          if (value === null || value === undefined) {
            return; // Permettre les valeurs null/undefined
          }
          
          // Vérifier si c'est un UUID valide
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(value)) {
            console.warn(`[TODOPG] ID utilisateur invalide: ${value}`);
            throw new Error('L\'ID utilisateur n\'est pas au format UUID valide');
          }
        }
      },
      onUpdate: 'CASCADE', // Si l'utilisateur est mis à jour, mettre à jour les tâches
      onDelete: 'SET NULL' // Si l'utilisateur est supprimé, conserver les tâches mais sans référence
    }
  }, {
    // Options du modèle
    timestamps: true, // Ajoute createdAt et updatedAt
    tableName: 'Todo', // Nom de la table au singulier pour cohérence
    freezeTableName: true, // Désactiver l'ajout de 's' à la fin du nom de table
    underscored: false, // IMPORTANT: Ne pas convertir les colonnes en snake_case
    quoteIdentifiers: true // IMPORTANT: Conserver les guillemets sur les identifiants
  });
  
  // Méthodes additionnelles comme celle pour vérifier les notifications
  Todo.prototype.shouldNotify = function() {
    try {
      // Vérifications de base
      if (!this.notificationsEnabled || this.completed) {
        return false;
      }
      
      if (!this.notificationEmail) {
        return false;
      }
      
      if (!this.dueDate) {
        return false;
      }
      
      // Créer une date d'échéance valide
      let dueDateTime = null;
      
      try {
        // Construire une date/heure d'échéance
        const dateStr = `${this.dueDate}T${this.dueTime || '00:00'}:00`;
        dueDateTime = new Date(dateStr);
        
        // Vérifier si la date est valide
        if (isNaN(dueDateTime.getTime())) {
          console.error('Date d\'échéance invalide pour la tâche:', this.title, dateStr);
          return false;
        }
      } catch (e) {
        console.error('Erreur lors de la création de la date d\'échéance:', e);
        return false;
      }
      
      const now = new Date();
      
      // Déterminer si la tâche est prévue pour aujourd'hui
      const isToday = this.isDateToday(dueDateTime);
      
      // Journaliser les décisions de notification pour le débogage
      console.log(`Évaluation de notification pour "${this.title}": 
        - Date d'échéance: ${dueDateTime.toISOString()}
        - Est aujourd'hui: ${isToday}
        - Notification déjà envoyée: ${this.notificationSent || false}
      `);
      
      // Ne pas notifier les tâches passées
      if (dueDateTime < now) {
        return false;
      }
      
      // Si la notification a déjà été envoyée
      if (this.notificationSent) {
        return false;
      }
      
      // Notification uniquement pour les tâches d'aujourd'hui
      return isToday;
    } catch (error) {
      console.error('Erreur lors de la vérification de notification pour la tâche:', this.title, error);
      return false;
    }
  };
  
  // Méthode pour vérifier si une date est aujourd'hui
  Todo.prototype.isDateToday = function(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };
  
  // Établir les associations avec User si le modèle existe
  const User = getUserModel();
  if (User) {
    console.log('[TODOPG] Établissement des associations avec le modèle User');
    Todo.belongsTo(User, { foreignKey: 'userId' });
    User.hasMany(Todo, { foreignKey: 'userId' });
  } else {
    console.log('[TODOPG] Modèle User non disponible, associations non établies');
  }
  
  return Todo;
};

// Fonction pour synchroniser le modèle avec la base de données
const syncTodoModel = async (force = false) => {
  try {
    console.log('[TODOPG] Tentative de synchronisation du modèle Todo');
    
    const Todo = getTodoModel();
    if (!Todo) {
      console.error('[TODOPG] Modèle Todo non disponible pour synchronisation');
      return false;
    }
    
    // Synchroniser le modèle avec force si nécessaire
    const forceSync = process.env.FORCE_SYNC === 'true' || force;
    console.log(`[TODOPG] Synchronisation avec force=${forceSync}`);
    
    // Tenter de créer la table manuellement avant la synchronisation
    try {
      const sequelize = getSequelize();
      if (sequelize) {
        console.log('[TODOPG] Tentative de création manuelle de la table Todo avant synchronisation');
        
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS "Todo" (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            "dueDate" DATE,
            "dueTime" VARCHAR(255),
            category VARCHAR(255) DEFAULT 'autre',
            priority VARCHAR(255) DEFAULT 'medium',
            completed BOOLEAN DEFAULT false,
            "notificationEmail" VARCHAR(255),
            "notificationsEnabled" BOOLEAN DEFAULT false,
            "notificationSent" BOOLEAN DEFAULT false,
            "userId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `);
        
        // Vérifier si la table a bien été créée
        const [checkResults] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'Todo'
          );
        `);
        
        const tableExists = checkResults[0]?.exists === true;
        console.log('[TODOPG] Vérification après création manuelle: Table Todo existe =', tableExists);
      }
    } catch (manualError) {
      console.error('[TODOPG] Erreur lors de la création manuelle de la table:', manualError);
      
      // Essayer une approche alternative en cas d'échec
      try {
        const sequelize = getSequelize();
        if (sequelize) {
          console.log('[TODOPG] Tentative alternative de création de table Todo');
          
          // Essayer sans les références au modèle User
          await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "Todo" (
              id SERIAL PRIMARY KEY,
              title VARCHAR(255) NOT NULL,
              description TEXT,
              "dueDate" VARCHAR(255),
              "dueTime" VARCHAR(255),
              category VARCHAR(255),
              priority VARCHAR(255),
              completed BOOLEAN DEFAULT false,
              "notificationEmail" VARCHAR(255),
              "notificationsEnabled" BOOLEAN DEFAULT false,
              "notificationSent" BOOLEAN DEFAULT false,
              "userId" VARCHAR(255),
              "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
            )
          `);
          
          console.log('[TODOPG] Table Todo créée avec méthode alternative');
        }
      } catch (altError) {
        console.error('[TODOPG] Échec de la tentative alternative:', altError);
      }
    }
    
    // Synchroniser le modèle
    await Todo.sync({ force: forceSync });
    console.log('[TODOPG] Modèle Todo synchronisé avec la base de données');
    
    // Vérifier à nouveau que la table existe
    try {
      const sequelize = getSequelize();
      if (sequelize) {
        const [checkResults] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'Todo'
          );
        `);
        
        const tableExists = checkResults[0]?.exists === true;
        console.log('[TODOPG] Vérification finale: Table Todo existe =', tableExists);
        
        // Si la table existe, vérifier les colonnes
        if (tableExists) {
          const [columns] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'Todo'
          `);
          
          console.log('[TODOPG] Colonnes de la table Todo:', columns.map(col => col.column_name).join(', '));
        }
      }
    } catch (checkError) {
      console.error('[TODOPG] Erreur lors de la vérification finale de la table:', checkError);
    }
    
    return true;
  } catch (error) {
    console.error('[TODOPG] Erreur lors de la synchronisation du modèle Todo:', error);
    
    // Dernière tentative de création de table en cas d'échec total
    try {
      console.log('[TODOPG] Tentative de dernier recours pour créer la table Todo');
      const sequelize = getSequelize();
      if (sequelize) {
        // Version simplifiée sans contraintes
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS "Todo" (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            "userId" VARCHAR(255),
            "createdAt" TIMESTAMP DEFAULT NOW(),
            "updatedAt" TIMESTAMP DEFAULT NOW()
          )
        `);
        
        console.log('[TODOPG] Table Todo créée avec structure minimale');
        return true;
      }
    } catch (lastError) {
      console.error('[TODOPG] Échec de la tentative de dernier recours:', lastError);
    }
    
    return false;
  }
};

// Variable pour stocker le modèle
let TodoModel = null;

// Initialiser et récupérer le modèle
const getTodoModel = () => {
  if (!TodoModel) {
    TodoModel = defineTodoModel();
  }
  return TodoModel;
};

module.exports = {
  defineTodoModel,
  syncTodoModel,
  getTodoModel
}; 