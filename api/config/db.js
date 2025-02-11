const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI missing');
      throw new Error('MONGODB_URI is not defined');
    }

    // Vérifier le format de l'URI
    if (!process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
      console.error('Invalid MongoDB URI format');
      throw new Error('Invalid MongoDB URI format');
    }

    // Ajouter le nom de la base de données si manquant
    let uri = process.env.MONGODB_URI;
    if (!uri.includes('?')) {
      uri = `${uri}/todolist?retryWrites=true&w=majority`;
    } else if (!uri.includes('/todolist')) {
      uri = uri.replace('/?', '/todolist?');
    }

    console.log('Connecting to MongoDB...');
    console.log('URI format valid:', uri.replace(/:[^:]*@/, ':***@'));

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,  // 5 secondes max pour la sélection du serveur
      socketTimeoutMS: 8000,           // 8 secondes max pour les opérations
      connectTimeoutMS: 8000           // 8 secondes max pour la connexion
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log('Connection state:', mongoose.connection.readyState);
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    return error;
  }
};

// Gérer les erreurs de connexion
mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

module.exports = connectDB; 