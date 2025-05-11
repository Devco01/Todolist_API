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
    
    // Si mode mémoire activé, créer un utilisateur factice depuis les infos du token
    if (process.env.USE_MEMORY_MODE === 'true') {
      console.log('[AUTH-MIDDLEWARE] Mode mémoire actif, utilisation des informations du token');
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
      console.log(`[AUTH-MIDDLEWARE] Utilisateur ${decoded.id} non trouvé en BDD mais token valide.`);
      console.log('[AUTH-MIDDLEWARE] Tentative de récupération par d\'autres moyens...');
      
      // Tentative de récupération par username comme solution de secours
      const UserModel = getUserModel();
      let fallbackUser = null;
      
      if (UserModel && decoded.username) {
        try {
          fallbackUser = await UserModel.findOne({
            where: { username: decoded.username }
          });
          
          if (fallbackUser) {
            console.log('[AUTH-MIDDLEWARE] Utilisateur récupéré par username', decoded.username);
          }
        } catch (fallbackError) {
          console.error('[AUTH-MIDDLEWARE] Erreur lors de la récupération fallback:', fallbackError);
        }
      }
      
      if (fallbackUser) {
        // Utiliser l'utilisateur trouvé
        req.user = {
          id: fallbackUser.id,
          username: fallbackUser.username,
          email: fallbackUser.email,
          isAdmin: fallbackUser.isAdmin || false
        };
        return next();
      }
      
      // Dernière solution : créer un utilisateur à partir du token
      if (process.env.ALLOW_TOKEN_FALLBACK === 'true' || process.env.USE_MEMORY_MODE === 'true') {
        console.log('[AUTH-MIDDLEWARE] Utilisation des infos du token comme fallback');
        req.user = {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          isAdmin: decoded.isAdmin || false
        };
        return next();
      }
      
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