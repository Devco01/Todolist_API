const mongoose = require('mongoose');
const config = require('../config/config');

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
    if (!this.notificationsEnabled || this.completed) {
      return false;
    }
    
    if (!this.notificationEmail) {
      return false;
    }
    
    if (!this.dueDate) {
      return false;
    }
    
    // Afficher les données pour le débogage
    if (config.notifications.debugMode) {
      console.log(`Vérification de notification pour: ${this.title}`);
      console.log(`Date d'échéance: ${this.dueDate}, Heure: ${this.dueTime || '00:00'}`);
    }
    
    // Créer une date d'échéance valide de manière plus robuste
    let dueDateTime = null;
    
    try {
      // Détection et conversion du format de date
      if (this.dueDate.includes('-')) { // Format YYYY-MM-DD
        // Utiliser ISO format avec la bonne heure
        const dateStr = `${this.dueDate}T${this.dueTime || '00:00'}:00`;
        dueDateTime = new Date(dateStr);
        
        // Vérifier si la date est valide
        if (isNaN(dueDateTime.getTime())) {
          // Essayer une méthode alternative
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
      } else if (this.dueDate.includes('/')) { // Format DD/MM/YYYY
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
        console.error('Format de date non reconnu:', this.dueDate);
        return false;
      }
    } catch (e) {
      console.error('Erreur lors de la création de la date d\'échéance:', e);
      return false;
    }
    
    // Vérifier si la date est valide
    if (!dueDateTime || isNaN(dueDateTime.getTime())) {
      console.error('Date d\'échéance invalide après conversion:', this.dueDate, this.dueTime);
      return false;
    }
    
    const now = new Date();
    
    // Afficher les dates/heures pour le débogage
    if (config.notifications.debugMode) {
      console.log(`Date actuelle: ${now.toISOString()}`);
      console.log(`Date d'échéance: ${dueDateTime.toISOString()}`);
    }
    
    // Calculer la différence en millisecondes et minutes
    const diff = dueDateTime.getTime() - now.getTime();
    const diffMinutes = Math.round(diff/60000);
    
    if (config.notifications.debugMode) {
      console.log(`Différence: ${diffMinutes} minutes`);
    }
    
    // Si la tâche est déjà passée, pas besoin de notification
    if (diffMinutes < 0) {
      console.log(`La tâche "${this.title}" est déjà passée, pas de notification`);
      return false;
    }
    
    // Si la notification a déjà été envoyée, vérifier si on est proche de l'échéance pour un rappel
    if (this.notificationSent) {
      // Envoyer un rappel urgent uniquement si on est très proche de l'échéance
      const isUrgent = diffMinutes > 0 && diffMinutes <= config.notifications.urgentReminderMinutes;
      
      if (isUrgent) {
        console.log(`⚠️ Rappel URGENT pour "${this.title}" - Échéance imminente dans ${diffMinutes} minutes!`);
        return true;
      }
      
      return false;
    }
    
    // Notification principale - autour d'une heure avant
    // Utiliser une fenêtre plus large pour éviter de manquer des notifications
    const minutesToNotify = config.notifications.notifyBeforeMinutes; // 1 heure avant l'échéance
    const tolerance = config.notifications.toleranceMinutes; // 7 minutes de tolérance pour être sûr
    
    const withinNotificationWindow = 
      diffMinutes >= (minutesToNotify - tolerance) && 
      diffMinutes <= (minutesToNotify + tolerance);
    
    if (withinNotificationWindow) {
      console.log(`🔔 Notification déclenchée pour la tâche "${this.title}" (échéance dans ${diffMinutes} minutes)`);
      return true;
    }
    
    // Si la tâche est à moins de 60 minutes de l'échéance, mais la notification n'a pas été envoyée
    // Cela permet de rattraper les notifications manquées
    if (diff > 0 && diffMinutes < minutesToNotify && !this.notificationSent) {
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