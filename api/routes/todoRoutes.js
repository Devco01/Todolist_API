const express = require('express');
const router = express.Router();

// Ce fichier est désactivé - toutes les routes Todo utilisent maintenant PostgreSQL
console.log('Routes Todo (MongoDB) désactivées. Utilisation des routes TodoPg à la place.');

// Redirection vers les fonctionnalités PostgreSQL
router.all('*', (req, res) => {
  res.status(301).json({
    message: 'Les routes MongoDB sont désactivées. Utilisez les routes PostgreSQL.',
    redirected: true
  });
});

module.exports = router; 