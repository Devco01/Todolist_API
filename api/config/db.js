const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI missing');
      throw new Error('MONGODB_URI is not defined');
    }

    console.log('MongoDB URI:', process.env.MONGODB_URI.replace(/:[^:]*@/, ':***@'));
    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
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