const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Chemin vers le fichier de sauvegarde locale
const LOCAL_DB_BACKUP_PATH = path.resolve(__dirname, '../data/todos-backup.json');

// S'assurer que le répertoire data existe
const ensureDataDirExists = () => {
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Charger les todos sauvegardés localement
const loadBackupTodos = () => {
  ensureDataDirExists();
  if (fs.existsSync(LOCAL_DB_BACKUP_PATH)) {
    try {
      const data = fs.readFileSync(LOCAL_DB_BACKUP_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Erreur lors du chargement des todos de sauvegarde:', error);
      return [];
    }
  }
  return [];
};

// Sauvegarder les todos localement
const saveBackupTodos = (todos) => {
  ensureDataDirExists();
  try {
    fs.writeFileSync(LOCAL_DB_BACKUP_PATH, JSON.stringify(todos, null, 2), 'utf8');
    console.log('Todos sauvegardés localement avec succès');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde locale des todos:', error);
  }
};

const connectDB = async () => {
  try {
    // Vérifier si nous sommes sur Vercel
    const isVercel = process.env.VERCEL === '1';
    
    if (!process.env.MONGODB_URI) {
      console.warn('La variable d\'environnement MONGODB_URI n\'est pas définie. Fonctionnement en mode local sans base de données.');
      return null;
    }
    
    console.log('Tentative de connexion à MongoDB...');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: isVercel ? 60000 : 10000, // Timeout plus long sur Vercel
      retryWrites: true,
      socketTimeoutMS: 45000, // Éviter les timeouts de socket
      heartbeatFrequencyMS: 10000, // Vérifier la connexion plus fréquemment
      keepAlive: true,
      keepAliveInitialDelay: 300000, // 5 minutes
      autoIndex: false // Désactiver les index automatiques pour de meilleures performances
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Application fonctionnant en mode local sans base de données.');
    
    // Sur Vercel, ne pas bloquer le déploiement en cas d'erreur de connexion
    if (process.env.VERCEL === '1') {
      console.log('Déploiement sur Vercel, continuant sans base de données.');
    }
    
    return null;
  }
};

// Gérer les erreurs de connexion
mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Reconnexion automatique en cas de déconnexion
mongoose.connection.on('disconnected', () => {
  console.log('Tentative de reconnexion à MongoDB...');
  setTimeout(() => {
    connectDB();
  }, 5000); // Attendre 5 secondes avant de tenter de se reconnecter
});

// Gérer la fermeture propre de la connexion lors de l'arrêt de l'application
process.on('SIGINT', async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
    }
  } catch (err) {
    console.error('Error closing MongoDB connection:', err);
  }
  process.exit(0);
});

module.exports = {
  connectDB,
  loadBackupTodos,
  saveBackupTodos
}; 