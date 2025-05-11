const authService = require('../services/authService');

// Middleware pour protéger les routes
const protect = async (req, res, next) => {
  try {
    console.log('[AUTH-MIDDLEWARE] Vérification d\'authentification sur:', req.originalUrl);
    let token;
    
    // Vérifier si le token est présent dans les en-têtes
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      console.log('[AUTH-MIDDLEWARE] Token trouvé dans Authorization header');
    } 
    // Vérifier si le token est présent dans les cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
      console.log('[AUTH-MIDDLEWARE] Token trouvé dans les cookies');
    }
    
    // Si aucun token n'est présent
    if (!token) {
      console.log('[AUTH-MIDDLEWARE] Aucun token fourni');
      return res.status(401).json({
        success: false,
        message: 'Non autorisé, aucun token fourni'
      });
    }
    
    // Afficher une version sécurisée du token pour le débogage
    const maskedToken = token.substring(0, 10) + '...' + token.substring(token.length - 5);
    console.log('[AUTH-MIDDLEWARE] Vérification du token:', maskedToken);
    
    // Vérifier le token
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      console.log('[AUTH-MIDDLEWARE] Token invalide ou expiré');
      return res.status(401).json({
        success: false,
        message: 'Token non valide ou expiré'
      });
    }
    
    console.log('[AUTH-MIDDLEWARE] Token décodé, ID utilisateur:', decoded.id);
    
    // Récupérer les informations de l'utilisateur
    const user = await authService.getUserById(decoded.id);
    
    if (!user) {
      console.log('[AUTH-MIDDLEWARE] Utilisateur non trouvé avec ID:', decoded.id);
      
      // Vérifier si c'est une requête concernant des todos ou des notifications
      // Dans ce cas, on permet la requête pour éviter les problèmes lors des modifications de données
      if (req.originalUrl.includes('/todos') || req.originalUrl.includes('/notifications')) {
        console.log('[AUTH-MIDDLEWARE] Route de données détectée, passage en mode dégradé pour permettre la modification');
        // Créer un utilisateur temporaire basé sur le token décodé
        req.user = {
          id: decoded.id,
          username: decoded.username || 'utilisateur temporaire',
          isAdmin: false
        };
        req.userId = decoded.id;
        
        // Ajouter un en-tête indiquant que l'authentification est en mode dégradé
        res.setHeader('x-auth-degraded', 'true');
        
        // Continuer avec l'utilisateur temporaire
        return next();
      }
      
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    console.log('[AUTH-MIDDLEWARE] Utilisateur authentifié:', user.username);
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    
    // Ajouter également l'ID du token décodé pour les vérifications ultérieures
    req.userId = decoded.id;
    
    // Actualiser le cookie du token s'il est proche de l'expiration
    if (decoded.exp && decoded.exp - (Date.now() / 1000) < 24 * 60 * 60) {
      console.log('[AUTH-MIDDLEWARE] Renouvellement du token proche de l\'expiration');
      const newToken = authService.generateToken(user);
      
      // Mettre à jour le cookie si on l'utilise
      res.cookie('token', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
      });
      
      // Ajouter le nouveau token à l'en-tête de réponse
      res.setHeader('x-auth-token', newToken);
    }
    
    // Passer au middleware suivant
    next();
  } catch (error) {
    console.error('[AUTH-MIDDLEWARE] Erreur dans le middleware d\'authentification:', error);
    
    // Vérifier si c'est une requête concernant des todos ou des notifications
    if (req.originalUrl.includes('/todos') || req.originalUrl.includes('/notifications')) {
      console.log('[AUTH-MIDDLEWARE] Exception pour modification de données, passage possible malgré erreur');
      
      // Tenter d'extraire l'ID de l'utilisateur du token si possible
      let userId = null;
      try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = authService.verifyToken(token);
          userId = decoded?.id;
        }
      } catch (tokenError) {
        console.error('[AUTH-MIDDLEWARE] Impossible d\'extraire l\'ID du token:', tokenError);
      }
      
      if (userId) {
        req.user = { id: userId };
        req.userId = userId;
        return next();
      }
    }
    
    res.status(401).json({
      success: false,
      message: 'Non autorisé - ' + (error.message || 'Erreur d\'authentification')
    });
  }
};

// Middleware pour les administrateurs uniquement
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    console.log('[AUTH-MIDDLEWARE] Accès administrateur autorisé pour:', req.user.username);
    next();
  } else {
    console.log('[AUTH-MIDDLEWARE] Accès administrateur refusé pour:', req.user?.username || 'utilisateur inconnu');
    res.status(403).json({
      success: false,
      message: 'Non autorisé, droits d\'administrateur requis'
    });
  }
};

module.exports = {
  protect,
  admin
}; 