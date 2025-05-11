const app = require('./server');
const dotenv = require('dotenv');
const path = require('path');
const authService = require('./services/authService');
const { syncTodoModel } = require('./models/TodoPg');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialiser les services et modèles
(async () => {
  try {
    console.log('Démarrage de l\'initialisation des services et modèles...');
    
    // Forcer la synchronisation en production pour corriger le problème de tables
    const forceSync = process.env.NODE_ENV === 'production'; 
    
    // Initialiser le service d'authentification (qui crée le modèle User)
    await authService.initAuthService();
    console.log('Service d\'authentification initialisé avec succès');
    
    // Synchroniser le modèle Todo après User
    await syncTodoModel(forceSync);
    console.log('Modèle Todo synchronisé avec succès');
    
    console.log('Tous les services et modèles ont été initialisés correctement');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des services et modèles:', error);
  }
})();

// Pour le déploiement Vercel
const isVercel = process.env.VERCEL === '1';
if (isVercel) {
  console.log('Environnement Vercel détecté');
}

// En développement local, démarrer le serveur
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`API disponible à l'adresse http://localhost:${PORT}/api`);
    console.log(`Page d'accueil disponible à l'adresse http://localhost:${PORT}/`);
  });
}

// Pour Vercel, nous devons exporter l'application
// Cette exportation doit être la dernière ligne du fichier
module.exports = app; 