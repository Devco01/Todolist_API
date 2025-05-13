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
      console.log(`[NOTIFICATION] Évaluation de la tâche "${this.title}" (ID: ${this.id})`);
      
      // Vérifications de base
      if (!this.notificationsEnabled) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": notifications désactivées`);
        return false;
      }
      
      if (this.completed) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": déjà complétée`);
        return false;
      }
      
      if (!this.notificationEmail) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": pas d'email de notification`);
        return false;
      }
      
      if (!this.dueDate) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": pas de date d'échéance`);
        return false;
      }
      
      // Créer une date d'échéance valide
      let dueDateTime = null;
      
      try {
        // Construire une date/heure d'échéance
        const dueTime = this.dueTime || '08:00'; // Heure par défaut: 8h du matin
        const dateStr = `${this.dueDate}T${dueTime}:00`;
        dueDateTime = new Date(dateStr);
        
        // Vérifier si la date est valide
        if (isNaN(dueDateTime.getTime())) {
          console.error(`[NOTIFICATION] Date d'échéance invalide pour la tâche "${this.title}": ${dateStr}`);
          return false;
        }
        
        console.log(`[NOTIFICATION] Date d'échéance pour "${this.title}": ${dueDateTime.toISOString()}`);
      } catch (e) {
        console.error(`[NOTIFICATION] Erreur lors de la création de la date d'échéance pour "${this.title}":`, e);
        return false;
      }
      
      const now = new Date();
      
      // Déterminer si la tâche est prévue pour aujourd'hui
      const isToday = this.isDateToday(dueDateTime);
      
      // Journaliser les décisions de notification pour le débogage
      console.log(`[NOTIFICATION] Évaluation de "${this.title}": 
        - Date d'échéance: ${dueDateTime.toISOString()}
        - Heure actuelle: ${now.toISOString()}
        - Est aujourd'hui: ${isToday ? 'OUI' : 'NON'}
        - Notification déjà envoyée: ${this.notificationSent ? 'OUI' : 'NON'}
        - Heure locale: ${now.getHours()}:${now.getMinutes()}
      `);
      
      // Ne pas notifier les tâches passées
      if (dueDateTime < now) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": la date d'échéance est déjà passée`);
        return false;
      }
      
      // Si la notification a déjà été envoyée
      if (this.notificationSent) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": notification déjà envoyée`);
        return false;
      }
      
      // Notification uniquement pour les tâches d'aujourd'hui
      if (!isToday) {
        console.log(`[NOTIFICATION] Tâche "${this.title}": pas prévue pour aujourd'hui`);
        return false;
      }
      
      // NOUVELLE LOGIQUE: Vérifier l'heure pour décider si on envoie maintenant
      // Par défaut, envoyer les notifications à 8h00 du matin
      const targetHour = 8; // 8h du matin
      const currentHour = now.getHours();
      
      console.log(`[NOTIFICATION] Heure actuelle pour "${this.title}": ${currentHour}h vs heure cible: ${targetHour}h`);
      
      // Vérifiez également si nous avons dépassé minuit mais pas encore atteint 8h
      if (currentHour >= 0 && currentHour < targetHour) {
        console.log(`[NOTIFICATION] Trop tôt pour envoyer la notification pour "${this.title}" (${currentHour}h vs ${targetHour}h), attente...`);
        return false;
      }
      
      // Si c'est après 8h et que la notification n'a pas été envoyée, l'envoyer
      console.log(`[NOTIFICATION] ENVOI de notification pour "${this.title}"`);
      return true;
    } catch (error) {
      console.error(`[NOTIFICATION] Erreur lors de la vérification de notification pour la tâche "${this.title}":`, error);
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
    
    // Vérifier d'abord si la table existe déjà
    console.log('[TODOPG] Vérification si la table Todo existe déjà');
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
        console.log('[TODOPG] Table Todo existe déjà:', tableExists);
        
        if (tableExists && !force) {
          console.log('[TODOPG] Table Todo existe déjà, pas besoin de la recréer');
          
          // Vérifier les colonnes de la table
          try {
            const [columns] = await sequelize.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_name = 'Todo'
            `);
            console.log('[TODOPG] Colonnes de la table Todo:', 
              columns.map(col => `${col.column_name} (${col.data_type})`).join(', '));
          } catch (colError) {
            console.error('[TODOPG] Erreur lors de la vérification des colonnes:', colError);
          }
          
          // Synchroniser doucement le modèle
          try {
            await Todo.sync({ alter: true }); // Mise à jour douce (alter)
            console.log('[TODOPG] Table Todo synchronisée en douceur');
            return true;
          } catch (syncError) {
            console.error('[TODOPG] Erreur lors de la synchronisation douce:', syncError);
            // Continuer malgré l'erreur
          }
          
          return true;
        }
      }
    } catch (checkError) {
      console.error('[TODOPG] Erreur lors de la vérification de la table:', checkError);
      // Continuer avec la création
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
        
        console.log('[TODOPG] Table Todo créée manuellement avec succès');
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
    
    // Synchroniser le modèle avec alter plutôt que force pour éviter de perdre les données
    try {
      await Todo.sync({ alter: true });
      console.log('[TODOPG] Modèle Todo synchronisé avec la base de données (alter)');
      
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
    } catch (syncError) {
      console.error('[TODOPG] Erreur lors de la synchronisation alter:', syncError);
      
      // Essayer avec force en dernier recours
      try {
        console.log('[TODOPG] Tentative avec force=true comme dernier recours');
        await Todo.sync({ force: true });
        console.log('[TODOPG] Modèle Todo synchronisé avec force=true');
        return true;
      } catch (forceSyncError) {
        console.error('[TODOPG] Échec aussi avec force=true:', forceSyncError);
        return false;
      }
    }
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

// Mode mémoire
let inMemoryTodos = [];
let isUsingMemoryMode = process.env.USE_MEMORY_MODE === 'true';

// Initialiser et récupérer le modèle
const getTodoModel = () => {
  if (TodoModel) {
    return TodoModel;
  }
  
  // Si le mode mémoire est explicitement activé
  if (isUsingMemoryMode) {
    console.log('[TODOPG] Mode mémoire activé, utilisation du modèle en mémoire');
    return getMemoryModel();
  }
  
  TodoModel = defineTodoModel();
  
  // Si le modèle n'a pas pu être défini, utiliser le mode mémoire
  if (!TodoModel) {
    console.log('[TODOPG] Échec de définition du modèle, utilisation du mode mémoire');
    isUsingMemoryMode = true;
    return getMemoryModel();
  }
  
  return TodoModel;
};

// Modèle en mémoire pour les todos
const getMemoryModel = () => {
  console.log('[TODOPG] Création du modèle mémoire pour Todo');
  
  // Structure du modèle mémoire avec les mêmes méthodes que Sequelize
  return {
    isUsingMemoryMode: true,
    findAll: async (options = {}) => {
      console.log('[TODOPG-MEMORY] Recherche de todos avec options:', options);
      
      // Filtrer les todos selon les critères
      let todos = [...inMemoryTodos];
      
      // Filtrer par utilisateur si spécifié
      if (options.where && options.where.userId) {
        todos = todos.filter(todo => todo.userId === options.where.userId);
      }
      
      // Filtrer par complété si spécifié
      if (options.where && options.where.completed !== undefined) {
        todos = todos.filter(todo => todo.completed === options.where.completed);
      }
      
      // Tri si spécifié
      if (options.order && options.order.length > 0) {
        const [field, direction] = options.order[0];
        todos.sort((a, b) => {
          if (direction === 'DESC') {
            return a[field] > b[field] ? -1 : 1;
          } else {
            return a[field] > b[field] ? 1 : -1;
          }
        });
      }
      
      return todos;
    },
    findByPk: async (id) => {
      console.log('[TODOPG-MEMORY] Recherche de todo par ID:', id);
      return inMemoryTodos.find(todo => todo.id === id);
    },
    findOne: async (options = {}) => {
      console.log('[TODOPG-MEMORY] Recherche d\'un todo avec options:', options);
      
      if (options.where && options.where.id) {
        return inMemoryTodos.find(todo => todo.id === options.where.id);
      }
      
      if (options.where && options.where.userId) {
        return inMemoryTodos.find(todo => todo.userId === options.where.userId);
      }
      
      return null;
    },
    create: async (todoData) => {
      console.log('[TODOPG-MEMORY] Création d\'un todo en mémoire');
      
      // Création d'un nouvel ID unique
      const id = Date.now().toString();
      
      // Création du todo avec les valeurs par défaut
      const newTodo = {
        id,
        title: todoData.title || 'Sans titre',
        description: todoData.description || '',
        dueDate: todoData.dueDate || null,
        dueTime: todoData.dueTime || null,
        category: todoData.category || 'autre',
        priority: todoData.priority || 'medium',
        completed: todoData.completed || false,
        notificationEmail: todoData.notificationEmail || null,
        notificationsEnabled: todoData.notificationsEnabled || false,
        notificationSent: todoData.notificationSent || false,
        userId: todoData.userId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Méthodes du prototype
        shouldNotify: function() {
          if (!this.notificationsEnabled || this.completed) {
            return false;
          }
          
          if (!this.notificationEmail) {
            return false;
          }
          
          if (!this.dueDate) {
            return false;
          }
          
          const now = new Date();
          const dueDateTime = new Date(`${this.dueDate}T${this.dueTime || '00:00'}:00`);
          
          // Ne pas notifier les tâches passées
          if (dueDateTime < now) {
            return false;
          }
          
          // Si la notification a déjà été envoyée
          if (this.notificationSent) {
            return false;
          }
          
          // Vérifier si la date est aujourd'hui
          return this.isDateToday(dueDateTime);
        },
        isDateToday: function(date) {
          const today = new Date();
          return date.getDate() === today.getDate() &&
                date.getMonth() === today.getMonth() &&
                date.getFullYear() === today.getFullYear();
        }
      };
      
      // Ajouter à la liste en mémoire
      inMemoryTodos.push(newTodo);
      
      console.log('[TODOPG-MEMORY] Todo créé avec ID:', id);
      return newTodo;
    },
    update: async (data, options) => {
      console.log('[TODOPG-MEMORY] Mise à jour d\'un todo avec options:', options);
      
      if (!options || !options.where || !options.where.id) {
        throw new Error('ID de todo non spécifié pour la mise à jour');
      }
      
      const todoId = options.where.id;
      const todoIndex = inMemoryTodos.findIndex(todo => todo.id === todoId);
      
      if (todoIndex === -1) {
        console.log('[TODOPG-MEMORY] Todo non trouvé pour mise à jour, ID:', todoId);
        return [0];
      }
      
      // Mettre à jour les champs
      inMemoryTodos[todoIndex] = {
        ...inMemoryTodos[todoIndex],
        ...data,
        updatedAt: new Date()
      };
      
      console.log('[TODOPG-MEMORY] Todo mis à jour, ID:', todoId);
      return [1];
    },
    destroy: async (options) => {
      console.log('[TODOPG-MEMORY] Suppression d\'un todo avec options:', options);
      
      if (!options || !options.where || !options.where.id) {
        throw new Error('ID de todo non spécifié pour la suppression');
      }
      
      const todoId = options.where.id;
      const initialLength = inMemoryTodos.length;
      
      inMemoryTodos = inMemoryTodos.filter(todo => todo.id !== todoId);
      
      const deletedCount = initialLength - inMemoryTodos.length;
      console.log('[TODOPG-MEMORY] Todos supprimés:', deletedCount);
      
      return deletedCount;
    }
  };
};

module.exports = {
  defineTodoModel,
  syncTodoModel,
  getTodoModel,
  // Pour les tests
  _getInMemoryTodos: () => isUsingMemoryMode ? [...inMemoryTodos] : null,
  _clearInMemoryTodos: () => { if (isUsingMemoryMode) inMemoryTodos = []; }
}; 