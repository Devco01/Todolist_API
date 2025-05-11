const app = require('./server');
const dotenv = require('dotenv');
const path = require('path');
const authService = require('./services/authService');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Initialiser le service d'authentification
(async () => {
  try {
    await authService.initAuthService();
    console.log('Service d\'authentification initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service d\'authentification:', error);
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