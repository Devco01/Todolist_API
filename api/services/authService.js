const jwt = require('jsonwebtoken');
const { getUserModel, syncUserModel } = require('../models/UserPg');
const { connectPostgres, getSequelize } = require('../config/postgres');
const { Op } = require('sequelize');

// Clé secrète pour les JWT - à remplacer par une variable d'environnement en production
const JWT_SECRET = process.env.JWT_SECRET || 'votre_clé_secrète_jwt';
const TOKEN_EXPIRATION = '7d'; // 7 jours

// Initialiser le service d'authentification
const initAuthService = async () => {
  try {
    console.log('[AUTH] Initialisation du service d\'authentification...');
    
    // Connecter à PostgreSQL
    const connection = await connectPostgres();
    console.log('[AUTH] Résultat de la connexion PostgreSQL:', connection ? 'Succès' : 'Échec');
    
    // Synchroniser le modèle utilisateur
    const syncResult = await syncUserModel();
    console.log('[AUTH] Résultat de la synchronisation du modèle utilisateur:', syncResult ? 'Succès' : 'Échec');
    
    console.log('[AUTH] Service d\'authentification initialisé avec succès');
    return true;
  } catch (error) {
    console.error('[AUTH] Erreur lors de l\'initialisation du service d\'authentification:', error);
    return false;
  }
};

// Enregistrer un nouvel utilisateur
const registerUser = async (userData) => {
  try {
    console.log('[AUTH] Tentative d\'enregistrement d\'un nouvel utilisateur:', userData.username);
    
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Modèle utilisateur non disponible');
      throw new Error('Modèle utilisateur non disponible');
    }
    
    // Vérifier si l'utilisateur existe déjà
    console.log('[AUTH] Vérification si l\'utilisateur existe déjà...');
    const existingUser = await UserModel.findOne({
      where: {
        [Op.or]: [
          { username: userData.username },
          { email: userData.email }
        ]
      }
    });
    
    if (existingUser) {
      console.log('[AUTH] Un utilisateur existe déjà avec ce nom ou cet email');
      throw new Error('Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà');
    }
    
    // Création d'un objet avec uniquement les champs nécessaires
    const userToCreate = {
      username: userData.username,
      email: userData.email,
      password: userData.password,
      isAdmin: userData.isAdmin || false
    };
    
    console.log('[AUTH] Création du nouvel utilisateur avec les données:', 
      { ...userToCreate, password: '***MASQUÉ***' });
    
    // Créer le nouvel utilisateur
    const newUser = await UserModel.create(userToCreate);
    console.log('[AUTH] Utilisateur créé avec succès:', newUser.id);
    
    // Générer un token JWT
    const token = generateToken(newUser);
    
    // Retourner l'utilisateur sans le mot de passe et le token
    const userResponse = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      isAdmin: newUser.isAdmin,
      createdAt: newUser.createdAt
    };
    
    console.log('[AUTH] Enregistrement réussi pour:', userResponse.username);
    
    return {
      user: userResponse,
      token
    };
  } catch (error) {
    console.error('[AUTH] Erreur détaillée lors de l\'enregistrement:', error);
    
    if (error.name === 'SequelizeValidationError') {
      console.error('[AUTH] Erreurs de validation:', error.errors.map(e => e.message).join(', '));
    }
    
    throw error;
  }
};

// Connecter un utilisateur existant
const loginUser = async (username, password) => {
  try {
    console.log('[AUTH] Tentative de connexion pour l\'utilisateur:', username);
    
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH] Modèle utilisateur non disponible');
      throw new Error('Modèle utilisateur non disponible');
    }
    
    // Chercher l'utilisateur par nom d'utilisateur ou email
    const user = await UserModel.findOne({
      where: {
        [Op.or]: [
          { username },
          { email: username } // Permet la connexion par email aussi
        ]
      }
    });
    
    if (!user) {
      console.log('[AUTH] Utilisateur non trouvé:', username);
      throw new Error('Utilisateur non trouvé');
    }
    
    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log('[AUTH] Mot de passe incorrect pour:', username);
      throw new Error('Mot de passe incorrect');
    }
    
    // Générer un token JWT
    const token = generateToken(user);
    
    // Retourner l'utilisateur sans le mot de passe et le token
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };
    
    console.log('[AUTH] Connexion réussie pour:', userResponse.username);
    
    return {
      user: userResponse,
      token
    };
  } catch (error) {
    console.error('[AUTH] Erreur lors de la connexion de l\'utilisateur:', error);
    throw error;
  }
};

// Générer un token JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin
    },
    JWT_SECRET,
    {
      expiresIn: TOKEN_EXPIRATION
    }
  );
};

// Vérifier un token JWT
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    return null;
  }
};

// Vérifier si un utilisateur existe
const userExists = async (username, email) => {
  try {
    const UserModel = getUserModel();
    if (!UserModel) {
      throw new Error('Modèle utilisateur non disponible');
    }
    
    const existingUser = await UserModel.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    
    return !!existingUser;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur:', error);
    throw error;
  }
};

// Obtenir un utilisateur par ID
const getUserById = async (userId) => {
  try {
    const UserModel = getUserModel();
    if (!UserModel) {
      throw new Error('Modèle utilisateur non disponible');
    }
    
    const user = await UserModel.findByPk(userId);
    
    if (!user) {
      return null;
    }
    
    // Retourner l'utilisateur sans le mot de passe
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    throw error;
  }
};

module.exports = {
  initAuthService,
  registerUser,
  loginUser,
  verifyToken,
  userExists,
  getUserById
}; 