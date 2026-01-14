const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcrypt');
const { getSequelize } = require('../config/postgres');

// Variable pour stocker le modèle
let UserModel = null;

// Mode de secours en mémoire
let inMemoryUsers = [];
let isUsingMemoryMode = process.env.USE_MEMORY_MODE === 'true';

// Force créer le modèle et la table immédiatement
const initUserModel = async (force = true) => {
  console.log('[USERPG] Initialisation forcée du modèle User');
  console.log('[USERPG] Mode mémoire activé:', isUsingMemoryMode);
  
  // Si le mode mémoire est explicitement activé, retourner immédiatement
  if (isUsingMemoryMode) {
    console.log('[USERPG] Utilisation du mode mémoire, pas de création de table nécessaire');
    return true;
  }
  
  // Obtenir l'instance Sequelize
  const sequelize = getSequelize();
  if (!sequelize) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[USERPG] Base de données non disponible en production. Refus d\'activer le mode mémoire implicitement.');
      return false;
    }

    console.log('[USERPG] Base de données non disponible, activation du mode mémoire (dev)');
    isUsingMemoryMode = true;
    return true;
  }
  
  try {
    // OPTIMISATION: Vérification rapide avec timeout pour éviter les timeouts Vercel
    console.log('[USERPG] Vérification si la table User existe déjà');
    let tableExists = false;
    try {
      // Timeout très court (1 seconde) pour la vérification
      const [checkResults] = await Promise.race([
        sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'User'
          );
        `),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 1000))
      ]);
      tableExists = checkResults[0]?.exists === true;
      console.log('[USERPG] Table User existe déjà:', tableExists);
      
      if (tableExists && !force) {
        console.log('[USERPG] Table User existe déjà, pas besoin de la recréer');
        
        // OPTIMISATION: Vérification des colonnes optionnelle et rapide
        try {
          const [columns] = await Promise.race([
            sequelize.query(`
              SELECT column_name, data_type 
              FROM information_schema.columns 
              WHERE table_name = 'User'
            `),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 500))
          ]);
          console.log('[USERPG] Colonnes de la table User:', 
            columns.map(col => `${col.column_name} (${col.data_type})`).join(', '));
        } catch (colError) {
          console.warn('[USERPG] Vérification des colonnes ignorée (timeout ou erreur):', colError.message);
          // Ne pas bloquer si cette vérification échoue
        }
        
        // CRITIQUE: En production, NE JAMAIS utiliser alter:true car ça recrée des contraintes
        // La table existe déjà, pas besoin de sync
        console.log('[USERPG] Table User existe déjà, pas de synchronisation nécessaire en production');
        return true;
        
        return true;
      }
    } catch (checkError) {
      console.warn('[USERPG] Vérification de la table échouée (non bloquant):', checkError.message);
      // Continuer avec la création ou activer mode mémoire
      if (checkError.message?.includes('timeout') || checkError.message?.includes('Connection')) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('[USERPG] Connexion DB trop lente en production. Mode mémoire REFUSÉ.');
          return false;
        }

        console.log('[USERPG] Connexion DB trop lente, activation du mode mémoire (dev)');
        isUsingMemoryMode = true;
        return true; // Retourner true pour continuer
      }
    }
    
    // OPTIMISATION: Créer la table seulement si elle n'existe pas, avec timeout court
    if (!tableExists) {
      console.log('[USERPG] Table User non trouvée, tentative de création avec timeout court');
      
      // Une seule tentative rapide avec timeout très court (1 seconde max)
      try {
        await Promise.race([
          sequelize.query(`
            CREATE TABLE IF NOT EXISTS "User" (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              username VARCHAR(255) NOT NULL UNIQUE,
              email VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              "isAdmin" BOOLEAN DEFAULT false,
              "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
          `),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Create table timeout')), 1000))
        ]);
        console.log('[USERPG] Table User créée avec succès');
      } catch (createError) {
        console.warn('[USERPG] Création de table timeout/échouée (non bloquant):', createError.message);
        // Ne pas bloquer - la table sera créée à la première utilisation
        console.log('[USERPG] Table sera créée automatiquement à la première utilisation');
        // En production, ne pas basculer en mémoire implicitement
        if (process.env.NODE_ENV === 'production') {
          console.warn('[USERPG] En production: mode mémoire REFUSÉ malgré l\'échec de création/sync.');
          return false;
        }

        // Activer le mode mémoire temporairement (dev)
        isUsingMemoryMode = true;
        return true; // Retourner true pour permettre la continuation
      }
    }
    
    // CRITIQUE: En production, NE JAMAIS utiliser alter:true car ça recrée des contraintes
    // Si la table existe déjà, pas besoin de sync
    const model = getUserModel();
    if (model && !isUsingMemoryMode) {
      // Vérifier si la table existe déjà
      try {
        const sequelize = getSequelize();
        if (sequelize) {
          const [checkResults] = await sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'User'
            );
          `);
          const tableExists = checkResults[0]?.exists === true;
          
          if (tableExists) {
            console.log('[USERPG] Table User existe déjà, pas de synchronisation nécessaire (évite recréation de contraintes)');
            return true;
          }
        }
      } catch (checkError) {
        console.warn('[USERPG] Vérification de table ignorée:', checkError.message);
      }
      
      // Seulement si la table n'existe pas, créer sans alter
      try {
        await Promise.race([
          model.sync({ force: false, alter: false }), // alter: false pour éviter recréation de contraintes
          new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 1000))
        ]);
        console.log('[USERPG] Table User créée avec succès');
        return true;
      } catch (syncError) {
        console.warn('[USERPG] Synchronisation ignorée (timeout ou erreur):', syncError.message);
        return true;
      }
    }
    
    return true;
  } catch (error) {
    console.error('[USERPG] Erreur globale lors de l\'initialisation du modèle User:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('[USERPG] En production: mode mémoire REFUSÉ après erreur d\'initialisation.');
      return false;
    }

    console.log('[USERPG] Activation du mode mémoire suite à une erreur (dev)');
    isUsingMemoryMode = true;
    return true;
  }
};

// Fonction pour obtenir le modèle
const getUserModel = () => {
  if (UserModel) return UserModel;
  
  // Si le mode mémoire est explicitement activé
  if (isUsingMemoryMode) {
    console.log('[USERPG] Mode mémoire activé, utilisation du modèle en mémoire');
    return getMemoryModel();
  }
  
  // Obtenir l'instance Sequelize
  const sequelize = getSequelize();
  
  // Si Sequelize n'est pas disponible, activer le mode mémoire
  if (!sequelize) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[USERPG] Base de données PostgreSQL non disponible en production. Mode mémoire implicite REFUSÉ.');
      return null;
    }

    console.log('[USERPG] Base de données PostgreSQL non disponible, activation du mode mémoire (dev)');
    isUsingMemoryMode = true;
    return getMemoryModel();
  }
  
  console.log('[USERPG] Définition du modèle User avec Sequelize');
  
  try {
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
      // CRITIQUE: Désactiver la modification de casse des noms de colonnes
      underscored: false,
      // CRITIQUE: Assurer que les noms de colonnes sont tels quels
      quoteIdentifiers: true,
      
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
    
    // Valider que le modèle est correctement défini
    if (!UserModel) {
      console.error('[USERPG] Échec de création du modèle Sequelize');
      isUsingMemoryMode = true;
      return getMemoryModel();
    }
    
    // Méthode pour vérifier le mot de passe
    UserModel.prototype.comparePassword = async function(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    };
    
    // Ajouter une méthode pour vérifier que le modèle est OK
    UserModel.testConnection = async function() {
      try {
        await sequelize.query('SELECT 1');
        return true;
      } catch (error) {
        console.error('[USERPG] Test de connexion échoué:', error);
        return false;
      }
    };
    
    UserModel.isUsingMemoryMode = false;
    
    return UserModel;
  } catch (error) {
    console.error('[USERPG] Erreur lors de la définition du modèle User:', error);
    if (process.env.NODE_ENV === 'production') {
      console.error('[USERPG] En production: mode mémoire REFUSÉ après erreur de définition du modèle.');
      return null;
    }

    isUsingMemoryMode = true;
    return getMemoryModel();
  }
};

// Helper pour le modèle mémoire
function getMemoryModel() {
  console.log('[USERPG] Retour au modèle mémoire après échec Sequelize');
  
  return {
    isUsingMemoryMode: true,
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
    // CRITIQUE: Ne JAMAIS utiliser forceSync ou alter:true en production
    // Cela recrée des contraintes et cause des index doublons
    const forceSync = (process.env.FORCE_SYNC === 'true' || force) && process.env.NODE_ENV !== 'production';
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (forceSync) {
      console.warn(`[USERPG] ⚠️ ATTENTION: ForceSync activé - Cela supprimera toutes les données !`);
    } else if (isProduction) {
      console.log(`[USERPG] Mode production: Pas de synchronisation (alter désactivé pour éviter recréation de contraintes)`);
      // En production, on ne fait rien si la table existe déjà
      const sequelize = getSequelize();
      if (sequelize) {
        try {
          const [checkResults] = await sequelize.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = 'User'
            );
          `);
          if (checkResults[0]?.exists === true) {
            console.log('[USERPG] Table User existe déjà, pas de synchronisation nécessaire');
            return true;
          }
        } catch (checkError) {
          // Continuer si la vérification échoue
        }
      }
    } else {
      console.log(`[USERPG] Mode développement: Synchronisation avec alter=false (force=${forceSync})`);
    }
    
    // Utiliser alter: false pour éviter de recréer des contraintes
    await model.sync({ force: false, alter: false });
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