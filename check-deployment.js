/**
 * Script de vérification de déploiement Vercel
 * 
 * Ce script vérifie que tous les fichiers nécessaires sont présents
 * et crée des fichiers factices si nécessaire pour éviter les erreurs
 * de module manquant lors du déploiement.
 */

const fs = require('fs');
const path = require('path');

console.log('Démarrage de la vérification du déploiement...');

// Liste des fichiers essentiels à vérifier
const requiredFiles = [
  {
    path: 'api/routes/todoRoutes.js',
    content: `const express = require('express');
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

module.exports = router;`
  },
  {
    path: 'api/models/Todo.js',
    content: `// Fichier factice pour éviter les erreurs d'importation
console.log('Modèle Todo (MongoDB) désactivé. Utilisation de TodoPg à la place.');

// Modèle factice qui ne fait rien
const todoSchema = {};
const Todo = {
  find: async () => [],
  findById: async () => null,
  create: async () => ({ _id: 'factice' }),
  findByIdAndUpdate: async () => null,
  findByIdAndDelete: async () => null
};

module.exports = Todo;`
  }
];

// Vérification de chaque fichier
let allFilesExist = true;

for (const file of requiredFiles) {
  const filePath = path.resolve(__dirname, file.path);
  
  try {
    // Vérifier si le fichier existe
    if (fs.existsSync(filePath)) {
      console.log(`✅ Le fichier ${file.path} existe.`);
    } else {
      console.log(`❌ Le fichier ${file.path} n'existe pas. Création en cours...`);
      
      // Créer le dossier parent si nécessaire
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Dossier ${dir} créé.`);
      }
      
      // Créer le fichier
      fs.writeFileSync(filePath, file.content);
      console.log(`📄 Fichier ${file.path} créé avec succès.`);
    }
  } catch (error) {
    console.error(`❌ Erreur lors de la vérification/création de ${file.path}:`, error);
    allFilesExist = false;
  }
}

// Rapport final
if (allFilesExist) {
  console.log('✅ Vérification complète: tous les fichiers requis sont présents.');
} else {
  console.error('❌ Certains fichiers n\'ont pas pu être vérifiés ou créés.');
  process.exit(1);
}

console.log('Vérification du déploiement terminée.'); 