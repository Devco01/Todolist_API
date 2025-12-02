const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { getUserModel, initUserModel } = require('../models/UserPg');
const { protect } = require('../middleware/authMiddleware');

// Initialiser le service d'authentification
authService.initAuthService();

// Middleware qui vérifie que le modèle User est prêt
const ensureUserModelReady = async (req, res, next) => {
  try {
    const UserModel = getUserModel();
    if (!UserModel) {
      console.error('[AUTH-ROUTE] Modèle User non disponible, tentative d\'initialisation...');
      
      // Tenter d'initialiser le modèle en urgence
      const initSuccess = await initUserModel(true);
      if (!initSuccess) {
        return res.status(500).json({
          success: false,
          message: 'Service d\'authentification temporairement indisponible, veuillez réessayer'
        });
      }
    }
    
    // Si nous arrivons ici, le modèle est disponible
    next();
  } catch (error) {
    console.error('[AUTH-ROUTE] Erreur lors de la vérification du modèle User:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur interne du service d\'authentification'
    });
  }
};

/**
 * @route   POST /api/auth/register
 * @desc    Enregistrer un nouvel utilisateur
 * @access  Public
 */
router.post('/register', ensureUserModelReady, async (req, res) => {
  try {
    console.log('[AUTH-ROUTE] Requête d\'inscription reçue');
    const { username, email, password } = req.body;
    
    console.log('[AUTH-ROUTE] Données reçues:', {
      username,
      email,
      password: password ? '***MASQUÉ***' : 'MANQUANT'
    });
    
    // Vérification des données requises
    if (!username || !email || !password) {
      console.log('[AUTH-ROUTE] Données manquantes:', {
        username: !!username,
        email: !!email,
        password: !!password
      });
      
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom d\'utilisateur, un email et un mot de passe'
      });
    }
    
    // Validation du mot de passe
    if (password.length < 6) {
      console.log('[AUTH-ROUTE] Mot de passe trop court:', password.length);
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit comporter au moins 6 caractères'
      });
    }
    
    console.log('[AUTH-ROUTE] Appel au service d\'authentification pour l\'inscription');
    
    // Enregistrer l'utilisateur
    const result = await authService.registerUser({
      username,
      email,
      password
    });
    
    console.log('[AUTH-ROUTE] Inscription réussie pour:', username);
    
    // Définir le token dans un cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    
    // Retourner les données de l'utilisateur
    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('[AUTH-ROUTE] Erreur lors de l\'enregistrement:', error);
    
    // Extraire le message d'erreur le plus précis possible
    let errorMessage = error.message || 'Erreur lors de l\'enregistrement';
    
    // Si c'est une erreur de validation Sequelize
    if (error.name === 'SequelizeValidationError') {
      errorMessage = error.errors.map(e => e.message).join(', ');
      console.error('[AUTH-ROUTE] Erreurs de validation:', errorMessage);
    }
    
    // Si c'est une erreur de contrainte unique
    if (error.name === 'SequelizeUniqueConstraintError') {
      errorMessage = 'Un utilisateur avec ce nom d\'utilisateur ou cet email existe déjà';
      console.error('[AUTH-ROUTE] Erreur de contrainte unique');
    }
    
    res.status(400).json({
      success: false,
      message: errorMessage
    });
  }
});

/**
 * @route   GET /api/auth/diagnostic
 * @desc    Diagnostic et réparation de la table User
 * @access  Public
 */
router.get('/diagnostic', async (req, res) => {
  try {
    console.log('[AUTH-DIAG] Démarrage du diagnostic d\'authentification');
    
    const sequelize = require('../config/postgres').getSequelize();
    if (!sequelize) {
      return res.status(500).json({
        success: false,
        message: 'Pas de connexion PostgreSQL disponible',
        canRepair: false
      });
    }
    
    // Vérifier si la table User existe
    let tableExists = false;
    try {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'User'
        );
      `);
      tableExists = results[0]?.exists === true;
      console.log('[AUTH-DIAG] La table User existe:', tableExists);
    } catch (checkError) {
      console.error('[AUTH-DIAG] Erreur lors de la vérification de la table:', checkError);
    }
    
    // Si la table n'existe pas, essayer de la créer
    if (!tableExists) {
      console.log('[AUTH-DIAG] Tentative de création manuelle de la table User');
      try {
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS "User" (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            "isAdmin" BOOLEAN DEFAULT false,
            "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
        `);
        console.log('[AUTH-DIAG] Table User créée avec succès');
      } catch (createError) {
        console.error('[AUTH-DIAG] Erreur lors de la création de la table:', createError);
        
        // Essayer avec une méthode alternative
        try {
          console.log('[AUTH-DIAG] Tentative avec méthode alternative');
          await sequelize.query(`
            CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
            CREATE TABLE IF NOT EXISTS "User" (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              username VARCHAR(255) NOT NULL UNIQUE,
              email VARCHAR(255) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              "isAdmin" BOOLEAN DEFAULT false,
              "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
          `);
          console.log('[AUTH-DIAG] Table User créée avec méthode alternative');
        } catch (altError) {
          console.error('[AUTH-DIAG] Échec de la méthode alternative:', altError);
          
          // Dernière tentative avec type VARCHAR pour l'ID
          try {
            console.log('[AUTH-DIAG] Tentative avec méthode basique');
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS "User" (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                email VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                "isAdmin" BOOLEAN DEFAULT false,
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL
              );
            `);
            console.log('[AUTH-DIAG] Table User créée avec méthode basique');
          } catch (basicError) {
            console.error('[AUTH-DIAG] Échec de toutes les méthodes:', basicError);
            return res.status(500).json({
              success: false,
              message: 'Impossible de créer la table User',
              error: basicError.message,
              canRepair: false
            });
          }
        }
      }
      
      // Vérifier à nouveau si la table existe
      try {
        const [results] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'User'
          );
        `);
        tableExists = results[0]?.exists === true;
        console.log('[AUTH-DIAG] Après réparation, la table User existe:', tableExists);
      } catch (recheckError) {
        console.error('[AUTH-DIAG] Erreur lors de la vérification après réparation:', recheckError);
      }
    }
    
    // Force initialiser le modèle User
    console.log('[AUTH-DIAG] Initialisation forcée du modèle User');
    await require('../models/UserPg').initUserModel(true);
    
    return res.status(200).json({
      success: true,
      message: tableExists ? 'Table User existe' : 'Table User créée avec succès',
      tableExists,
      tables: await listTables(sequelize)
    });
  } catch (error) {
    console.error('[AUTH-DIAG] Erreur lors du diagnostic:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du diagnostic',
      error: error.message
    });
  }
});

// Fonction utilitaire pour lister les tables
async function listTables(sequelize) {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    return results.map(r => r.table_name);
  } catch (error) {
    console.error('[AUTH-DIAG] Erreur lors de la récupération des tables:', error);
    return [];
  }
}

/**
 * @route   POST /api/auth/login
 * @desc    Connecter un utilisateur
 * @access  Public
 */
router.post('/login', ensureUserModelReady, async (req, res) => {
  try {
    console.log('[AUTH-ROUTE] Requête de connexion reçue');
    const { username, password } = req.body;
    
    console.log('[AUTH-ROUTE] Tentative de connexion pour:', username);
    
    // Vérification des données requises
    if (!username || !password) {
      console.log('[AUTH-ROUTE] Données de connexion manquantes:', {
        username: !!username,
        password: !!password
      });
      
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom d\'utilisateur et un mot de passe'
      });
    }
    
    // Vérifier si la base de données est accessible
    const { getSequelize } = require('../config/postgres');
    const sequelize = getSequelize();
    let dbAvailable = false;
    
    if (sequelize) {
      try {
        await Promise.race([
          sequelize.authenticate(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]);
        dbAvailable = true;
        console.log('[AUTH-ROUTE] Connexion DB disponible');
      } catch (dbError) {
        console.warn('[AUTH-ROUTE] Connexion DB non disponible:', dbError.message);
        dbAvailable = false;
      }
    }
    
    // Si la DB n'est pas disponible, retourner une erreur explicite
    if (!dbAvailable) {
      console.error('[AUTH-ROUTE] Base de données non disponible pour la connexion');
      return res.status(503).json({
        success: false,
        message: 'Service temporairement indisponible',
        details: 'La base de données n\'est pas accessible pour le moment. Veuillez réessayer dans quelques instants.',
        dbAvailable: false
      });
    }
    
    // Connecter l'utilisateur
    let result;
    try {
      result = await authService.loginUser(username, password);
      console.log('[AUTH-ROUTE] Connexion réussie pour:', username);
    } catch (loginError) {
      console.error('[AUTH-ROUTE] Erreur lors de l\'authentification:', loginError);
      
      // Gérer les erreurs de connexion DB qui peuvent survenir pendant loginUser
      if (loginError.name === 'SequelizeConnectionError' || 
          loginError.name === 'SequelizeConnectionRefusedError' ||
          loginError.message?.includes('connection') ||
          loginError.message?.includes('Connection') ||
          loginError.message?.includes('non disponible')) {
        return res.status(503).json({
          success: false,
          message: 'Service temporairement indisponible',
          details: 'La base de données n\'est pas accessible pour le moment. Veuillez réessayer dans quelques instants.',
          dbAvailable: false
        });
      }
      
      // Erreurs d'authentification (utilisateur non trouvé, mot de passe incorrect)
      if (loginError.message?.includes('non trouvé') || 
          loginError.message?.includes('incorrect') ||
          loginError.message?.includes('not found') ||
          loginError.message?.includes('password')) {
        return res.status(401).json({
          success: false,
          message: loginError.message || 'Identifiants incorrects'
        });
      }
      
      // Erreurs inattendues
      console.error('[AUTH-ROUTE] Erreur inattendue lors de la connexion:', loginError);
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la connexion',
        details: loginError.message || 'Une erreur inattendue s\'est produite'
      });
    }
    
    // Définir le token dans un cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
    });
    
    // Retourner les données de l'utilisateur
    res.status(200).json({
      success: true,
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('[AUTH-ROUTE] Erreur inattendue dans le handler login:', error);
    
    // Si l'erreur vient du middleware ensureUserModelReady
    if (error.message?.includes('temporairement indisponible')) {
      return res.status(503).json({
        success: false,
        message: 'Service temporairement indisponible',
        details: error.message
      });
    }
    
    // Erreurs d'authentification
    if (error.message?.includes('non trouvé') || 
        error.message?.includes('incorrect') ||
        error.message?.includes('Identifiants')) {
      return res.status(401).json({
        success: false,
        message: error.message || 'Identifiants incorrects'
      });
    }
    
    // Par défaut, retourner 500 avec un message générique
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      details: error.message || 'Une erreur inattendue s\'est produite'
    });
  }
});

/**
 * @route   GET /api/auth/logout
 * @desc    Déconnecter un utilisateur
 * @access  Private
 */
router.get('/logout', protect, (req, res) => {
  // Effacer le cookie
  res.clearCookie('token');
  
  res.status(200).json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Obtenir les informations de l'utilisateur connecté
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

module.exports = router; 