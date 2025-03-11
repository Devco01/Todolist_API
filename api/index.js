const app = require('./server');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Pour Vercel, nous devons exporter l'application
module.exports = app;

// En développement local, démarrer le serveur
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`API disponible à l'adresse http://localhost:${PORT}/api`);
  });
} 