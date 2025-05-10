// Configuration centralisée de l'application
require('dotenv').config();

const config = {
  // Configuration de l'environnement
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Configuration du serveur
  port: process.env.PORT || 3000,
  
  // Configuration de la base de données
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/todolist',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  
  // Configuration des emails
  email: {
    // SendGrid (recommandé pour la production)
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      from: process.env.EMAIL_FROM || 'todolist@notification.com'
    },
    
    // SMTP général
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },
  
  // Configuration des notifications
  notifications: {
    debugMode: process.env.DEBUG_NOTIFICATIONS === 'true',
    // Fréquence de vérification des notifications
    // En production: toutes les minutes, en dev: toutes les 15 secondes
    checkFrequency: process.env.NODE_ENV === 'production' ? '* * * * *' : '*/15 * * * * *',
    // Délai avant notification (en minutes)
    notifyBeforeMinutes: 60,
    // Tolérance pour la notification (en minutes)
    toleranceMinutes: 7,
    // Délai pour notification d'urgence (en minutes)
    urgentReminderMinutes: 15
  }
};

module.exports = config; 