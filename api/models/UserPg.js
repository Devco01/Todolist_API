const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const { getSequelize } = require('../config/postgres');

// Variable pour stocker le modèle
let UserModel = null;

// Fonction pour obtenir le modèle
const getUserModel = () => {
  if (UserModel) return UserModel;
  
  const sequelize = getSequelize();
  if (!sequelize) return null;
  
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
        notEmpty: true,
        len: [3, 30]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [6, 100]
      }
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    // Hooks pour hacher le mot de passe avant la création/mise à jour
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
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
  const model = getUserModel();
  if (model) {
    await model.sync({ force });
    console.log('Modèle User synchronisé avec la base de données');
    return true;
  }
  return false;
};

// Exporter les fonctions
module.exports = {
  getUserModel,
  syncUserModel
}; 