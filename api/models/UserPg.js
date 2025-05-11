const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { getSequelize } = require('../config/postgres');

// Variable pour stocker le modèle
let UserModel = null;

// Mode de secours en mémoire
let inMemoryUsers = [];
let isUsingMemoryMode = false;

// Force créer le modèle et la table immédiatement
const initUserModel = async (force = true) => {
  console.log('[USERPG] Initialisation forcée du modèle User');
  
  // Obtenir l'instance Sequelize
  const sequelize = getSequelize();
  if (!sequelize) {
    console.log('[USERPG] Base de données non disponible, initialisation impossible');
    return false;
  }
  
  // Récupérer le modèle
  const model = getUserModel();
  if (!model) {
    console.log('[USERPG] Échec de création du modèle User');
    return false;
  }
  
  try {
    // Force synchroniser le modèle
    console.log(`[USERPG] Force synchronisation du modèle User (force=${force})`);
    await model.sync({ force });
    console.log('[USERPG] Table User créée/synchronisée avec succès');
    return true;
  } catch (error) {
    console.error('[USERPG] Erreur lors de la synchronisation forcée:', error);
    return false;
  }
};

// Fonction pour obtenir le modèle
const getUserModel = () => {
  if (UserModel) return UserModel;
  
  // Obtenir l'instance Sequelize
  const sequelize = getSequelize();
  
  // Si Sequelize n'est pas disponible, activer le mode mémoire
  if (!sequelize) {
    console.log('[USERPG] Base de données PostgreSQL non disponible, activation du mode mémoire');
    isUsingMemoryMode = true;
    
    // Renvoyer un modèle factice avec les mêmes méthodes
    return {
      findOne: async ({ where }) => {
        console.log('[USERPG-MEMORY] Recherche d\'utilisateur avec critères:', where);
        
        if (where && where[Op.or]) {
          // Recherche OR pour username ou email
          const criteria = where[Op.or];
          return inMemoryUsers.find(user => 
            (criteria[0].username && user.username === criteria[0].username) || 
            (criteria[1].email && user.email === criteria[1].email)
          );
        } else if (where && where.id) {
          // Recherche par ID
          return inMemoryUsers.find(user => user.id === where.id);
        } else if (where && where.username) {
          // Recherche par username
          return inMemoryUsers.find(user => user.username === where.username);
        } else if (where && where.email) {
          // Recherche par email
          return inMemoryUsers.find(user => user.email === where.email);
        }
        
        return null;
      },
      findByPk: async (id) => {
        console.log('[USERPG-MEMORY] Recherche d\'utilisateur par ID:', id);
        return inMemoryUsers.find(user => user.id === id);
      },
      create: async (userData) => {
        console.log('[USERPG-MEMORY] Création d\'utilisateur en mémoire');
        
        // Validation de base
        if (!userData.username || userData.username.length < 3) {
          throw new Error('Le nom d\'utilisateur doit contenir au moins 3 caractères');
        }
        
        if (!userData.email || !/\S+@\S+\.\S+/.test(userData.email)) {
          throw new Error('Email invalide');
        }
        
        if (!userData.password || userData.password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères');
        }
        
        // Vérifier si l'utilisateur existe déjà
        const existingUser = inMemoryUsers.find(
          user => user.username === userData.username || user.email === userData.email
        );
        
        if (existingUser) {
          throw new Error('Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà');
        }
        
        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userData.password, salt);
        
        // Créer le nouvel utilisateur
        const newUser = {
          id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          username: userData.username,
          email: userData.email,
          password: hashedPassword,
          isAdmin: userData.isAdmin || false,
          createdAt: new Date(),
          updatedAt: new Date(),
          comparePassword: async function(candidatePassword) {
            return bcrypt.compare(candidatePassword, this.password);
          }
        };
        
        // Ajouter à la liste en mémoire
        inMemoryUsers.push(newUser);
        
        console.log('[USERPG-MEMORY] Utilisateur créé avec ID:', newUser.id);
        return newUser;
      }
    };
  }
  
  console.log('[USERPG] Définition du modèle User avec Sequelize');
  
  // Définir le modèle
  UserModel = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: 'Le nom d\'utilisateur ne peut pas être vide'
        },
        len: {
          args: [3, 30],
          msg: 'Le nom d\'utilisateur doit contenir entre 3 et 30 caractères'
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: {
          msg: 'Email invalide'
        }
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'Le mot de passe ne peut pas être vide'
        },
        len: {
          args: [6, 100],
          msg: 'Le mot de passe doit contenir au moins 6 caractères'
        }
      }
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    // Assurer la cohérence du nom de la table
    tableName: 'User',
    // Désactiver l'ajout de 's' à la fin du nom de table
    freezeTableName: true,
    // Hooks pour hacher le mot de passe avant la création/mise à jour
    hooks: {
      beforeCreate: async (user) => {
        console.log('[USERPG] Hook beforeCreate exécuté');
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        console.log('[USERPG] Hook beforeUpdate exécuté');
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });
  
  // Méthode pour vérifier le mot de passe
  UserModel.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };
  
  return UserModel;
};

// Fonction pour synchroniser le modèle avec la base de données
const syncUserModel = async (force = false) => {
  console.log('[USERPG] Tentative de synchronisation du modèle User');
  
  const model = getUserModel();
  if (!model) {
    console.error('[USERPG] Impossible d\'obtenir le modèle User');
    return false;
  }
  
  // Si on est en mode mémoire, ne pas synchroniser
  if (isUsingMemoryMode) {
    console.log('[USERPG] Mode mémoire actif, synchronisation ignorée');
    return true;
  }
  
  try {
    // Forcer la création de la table
    const forceSync = process.env.FORCE_SYNC === 'true' || force;
    console.log(`[USERPG] Synchronisation du modèle avec force=${forceSync}`);
    
    await model.sync({ force: forceSync });
    console.log('[USERPG] Modèle User synchronisé avec la base de données');
    return true;
  } catch (error) {
    console.error('[USERPG] Erreur lors de la synchronisation du modèle User:', error);
    return false;
  }
};

// Exporter les fonctions
module.exports = {
  getUserModel,
  syncUserModel,
  initUserModel,
  // Pour les tests
  _getInMemoryUsers: () => isUsingMemoryMode ? [...inMemoryUsers] : null
}; 