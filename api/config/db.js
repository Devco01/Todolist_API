const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Variable pour stocker l'état de la connexion
let isConnected = false;

// Connexion à MongoDB
const connectDB = async () => {
  try {
    if (isConnected) {
      console.log('Utilisation de la connexion MongoDB existante');
      return;
    }

    // Utiliser l'URI de connexion provenant de la configuration
    const conn = await mongoose.connect(config.db.uri, config.db.options);

    console.log(`MongoDB connecté: ${conn.connection.host}`);
    isConnected = true;
    
    // Mettre à jour la variable globale dans l'application
    if (global.app) {
      global.app.set('isMongoConnected', true);
    }
    
    return conn;
  } catch (error) {
    console.error(`Erreur de connexion à MongoDB: ${error.message}`);
    isConnected = false;
    
    // Mettre à jour la variable globale dans l'application
    if (global.app) {
      global.app.set('isMongoConnected', false);
    }
    
    // Ne pas faire échouer l'application, mais retourner l'erreur
    return { error };
  }
};

// Fonction pour sauvegarder en tant que fichier JSON (solution de secours)
const saveBackupTodos = async (todos) => {
  try {
    const dataDir = path.join(__dirname, '../data');
    
    // Créer le répertoire data s'il n'existe pas
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'todos-backup.json');
    fs.writeFileSync(filePath, JSON.stringify(todos, null, 2));
    console.log(`Sauvegarde de ${todos.length} tâches dans ${filePath}`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des tâches:', error);
    return false;
  }
};

// Fonction pour charger depuis un fichier JSON (solution de secours)
const loadBackupTodos = async () => {
  try {
    const filePath = path.join(__dirname, '../data/todos-backup.json');
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    const todos = JSON.parse(data);
    console.log(`Chargement de ${todos.length} tâches depuis ${filePath}`);
    return todos;
  } catch (error) {
    console.error('Erreur lors du chargement des tâches:', error);
    return [];
  }
};

// Vérifier l'état de la connexion MongoDB
const checkConnection = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    state: mongoose.connection.readyState
  };
};

module.exports = {
  connectDB,
  saveBackupTodos,
  loadBackupTodos,
  checkConnection
}; 