const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
      serverSelectionTimeoutMS: isVercel ? 30000 : 5000 // Timeout plus long sur Vercel
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

module.exports = connectDB; 