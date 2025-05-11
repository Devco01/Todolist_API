const authService = require('../services/authService');

// Middleware pour protéger les routes
const protect = async (req, res, next) => {
  try {
    let token;
    
    // Vérifier si le token est présent dans les en-têtes
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } 
    // Vérifier si le token est présent dans les cookies
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    // Si aucun token n'est présent
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé, aucun token fourni'
      });
    }
    
    // Vérifier le token
    const decoded = authService.verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token non valide ou expiré'
      });
    }
    
    // Récupérer les informations de l'utilisateur
    const user = await authService.getUserById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }
    
    // Ajouter l'utilisateur à la requête
    req.user = user;
    
    // Passer au middleware suivant
    next();
  } catch (error) {
    console.error('Erreur dans le middleware d\'authentification:', error);
    res.status(401).json({
      success: false,
      message: 'Non autorisé'
    });
  }
};

// Middleware pour les administrateurs uniquement
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
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