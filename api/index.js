const app = require('./server');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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