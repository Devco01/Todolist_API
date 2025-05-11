const jwt = require('jsonwebtoken');
const authService = require('../services/authService');
const { getUserModel } = require('../models/UserPg');

// Middleware pour protéger les routes
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Vérifier si un token est présent dans les headers ou les cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Token au format Bearer
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      // Token dans les cookies
      token = req.cookies.token;
    } else if (req.headers['x-auth-token']) {
      // Token dans l'en-tête x-auth-token
      token = req.headers['x-auth-token'];
    }
    
    // Vérifier si le token existe
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Aucun token fourni'
      });
    }
    
    // Vérifier et décoder le token
    const decoded = authService.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Token invalide ou expiré'
      });
    }
    
    // Si mode mémoire activé, créer un utilisateur factice
    if (process.env.USE_MEMORY_MODE === 'true') {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
        isAdmin: decoded.isAdmin || false
      };
      return next();
    }
    
    // Récupérer l'utilisateur à partir de la base de données
    const user = await authService.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Utilisateur non trouvé'
      });
    }
    
    // Attacher l'utilisateur à la requête
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin || false
    };
    
    next();
  } catch (error) {
    console.error('Erreur d\'authentification:', error);
    res.status(401).json({
      success: false,
      message: 'Non autorisé - Erreur du serveur'
    });
  }
};

// Middleware pour restreindre l'accès aux administrateurs
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Non autorisé - Accès administrateur requis'
    });
  }
};

module.exports = { protect, admin }; 