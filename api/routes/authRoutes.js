const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { protect } = require('../middleware/authMiddleware');

// Initialiser le service d'authentification
authService.initAuthService();

/**
 * @route   POST /api/auth/register
 * @desc    Enregistrer un nouvel utilisateur
 * @access  Public
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Vérification des données requises
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom d\'utilisateur, un email et un mot de passe'
      });
    }
    
    // Validation du mot de passe
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit comporter au moins 6 caractères'
      });
    }
    
    // Enregistrer l'utilisateur
    const result = await authService.registerUser({
      username,
      email,
      password
    });
    
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
    console.error('Erreur lors de l\'enregistrement:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Connecter un utilisateur
 * @access  Public
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Vérification des données requises
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez fournir un nom d\'utilisateur et un mot de passe'
      });
    }
    
    // Connecter l'utilisateur
    const result = await authService.loginUser(username, password);
    
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
    console.error('Erreur lors de la connexion:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Identifiants incorrects'
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