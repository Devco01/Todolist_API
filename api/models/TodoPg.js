const { DataTypes } = require('sequelize');
const { getSequelize } = require('../config/postgres');

// Définition du modèle Todo pour PostgreSQL avec Sequelize
const defineTodoModel = () => {
  const sequelize = getSequelize();
  
  // Si pas de connexion Sequelize, ne pas définir le modèle
  if (!sequelize) {
    return null;
  }
  
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
        isEmail: true
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
    }
  }, {
    // Options du modèle
    timestamps: true, // Ajoute createdAt et updatedAt
    tableName: 'todos' // Nom de la table en minuscules et au pluriel
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
          return false;
        }
      } catch (e) {
        console.error('Erreur lors de la création de la date d\'échéance:', e);
        return false;
      }
      
      const now = new Date();
      
      // Calculer la différence en millisecondes et minutes
      const diff = dueDateTime.getTime() - now.getTime();
      const diffMinutes = Math.round(diff/60000);
      
      // Si la tâche est déjà passée, pas besoin de notification
      if (diffMinutes < 0) {
        return false;
      }
      
      // Si la notification a déjà été envoyée
      if (this.notificationSent) {
        // Envoyer un rappel urgent uniquement si on est très proche de l'échéance
        return diffMinutes > 0 && diffMinutes <= 15; // 15 minutes avant comme rappel urgent
      }
      
      // Notification principale - autour d'une heure avant
      const withinNotificationWindow = 
        diffMinutes >= 53 && // 1h - 7min
        diffMinutes <= 67;   // 1h + 7min
      
      return withinNotificationWindow || (diff > 0 && diffMinutes < 60 && !this.notificationSent);
    } catch (error) {
      console.error('Erreur lors de la vérification de notification:', error);
      return false;
    }
  };
  
  return Todo;
};

// Fonction pour synchroniser le modèle avec la base de données
const syncTodoModel = async (force = false) => {
  try {
    const Todo = getTodoModel();
    if (!Todo) return false;
    
    // Synchroniser le modèle
    await Todo.sync({ force });
    console.log('Modèle Todo synchronisé avec la base de données');
    return true;
  } catch (error) {
    console.error('Erreur lors de la synchronisation du modèle Todo:', error);
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