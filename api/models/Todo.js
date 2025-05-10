const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le titre est requis'],
    trim: true,
    maxlength: [100, 'Le titre ne peut pas dépasser 100 caractères']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'La description ne peut pas dépasser 500 caractères']
  },
  dueDate: String,
  dueTime: String,
  category: {
    type: String,
    enum: ['maison', 'courses', 'santé', 'travail', 'famille', 'autre'],
    default: 'autre'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  completed: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  notificationEmail: {
    type: String,
    validate: {
      validator: function(v) {
        return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(v) || v === '';
      },
      message: props => `${props.value} n'est pas une adresse email valide!`
    }
  },
  notificationsEnabled: {
    type: Boolean,
    default: false
  },
  notificationSent: {
    type: Boolean,
    default: false
  }
});

todoSchema.methods.shouldNotify = function() {
  try {
    // Vérifications de base
    if (!this.notificationsEnabled || this.notificationSent || this.completed) {
      return false;
    }
    
    if (!this.notificationEmail) {
      return false;
    }
    
    if (!this.dueDate) {
      return false;
    }
    
    // Afficher les données pour le débogage
    console.log(`Vérification de notification pour: ${this.title}`);
    console.log(`Date d'échéance: ${this.dueDate}, Heure: ${this.dueTime || '00:00'}`);
    
    // Méthode simplifiée pour créer une date d'échéance valide
    let dueDateTime;
    
    try {
      // Utiliser directement le format ISO pour plus de fiabilité
      dueDateTime = new Date(`${this.dueDate}T${this.dueTime || '00:00'}`);
    } catch (e) {
      console.error('Erreur lors de la création de la date d\'échéance:', e);
      
      // Tentative alternative de création de la date
      try {
        // Format YYYY-MM-DD
        if (this.dueDate.includes('-')) {
          const [year, month, day] = this.dueDate.split('-');
          const [hours, minutes] = (this.dueTime || '00:00').split(':');
          dueDateTime = new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hours), 
            parseInt(minutes)
          );
        } 
        // Format DD/MM/YYYY
        else if (this.dueDate.includes('/')) {
          const [day, month, year] = this.dueDate.split('/');
          const [hours, minutes] = (this.dueTime || '00:00').split(':');
          dueDateTime = new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hours), 
            parseInt(minutes)
          );
        } else {
          return false;
        }
      } catch (e2) {
        console.error('Seconde erreur lors de la création de la date d\'échéance:', e2);
        return false;
      }
    }
    
    // Vérifier si la date est valide
    if (isNaN(dueDateTime.getTime())) {
      console.error('Date d\'échéance invalide:', this.dueDate, this.dueTime);
      return false;
    }
    
    const now = new Date();
    
    // Afficher les dates/heures pour le débogage
    console.log(`Date actuelle: ${now.toISOString()}`);
    console.log(`Date d'échéance: ${dueDateTime.toISOString()}`);
    
    // Calculer la différence en millisecondes
    const diff = dueDateTime.getTime() - now.getTime();
    const diffMinutes = Math.round(diff/60000);
    
    console.log(`Différence: ${diffMinutes} minutes`);
    
    // Notification si le délai est entre 55 et 65 minutes avant l'échéance
    // Cette fenêtre plus large permet de s'assurer que la notification est envoyée
    const minutesToNotify = 60; // 1 heure avant l'échéance
    const tolerance = 5; // 5 minutes de tolérance
    
    const withinNotificationWindow = 
      diffMinutes >= (minutesToNotify - tolerance) && 
      diffMinutes <= (minutesToNotify + tolerance);
    
    if (withinNotificationWindow) {
      console.log(`🔔 Notification déclenchée pour la tâche "${this.title}" (échéance dans ${diffMinutes} minutes)`);
      return true;
    }
    
    // Si la tâche est à moins de 60 minutes de l'échéance, mais la notification n'a pas été envoyée
    if (diff > 0 && diff <= 3600000 && !this.notificationSent) {
      console.log(`⚠️ La tâche "${this.title}" échoit bientôt (${diffMinutes} min) et n'a pas été notifiée. Envoi immédiat.`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erreur lors de la vérification de notification:', error);
    return false;
  }
};

module.exports = mongoose.model('Todo', todoSchema); 