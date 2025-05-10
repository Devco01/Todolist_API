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
    
    if (!this.dueDate || !this.dueTime) {
      return false;
    }
    
    // Conversion de la date
    let year, month, day;
    
    // Gérer les deux formats possibles de date
    if (this.dueDate.includes('-')) {
      // Format YYYY-MM-DD
      [year, month, day] = this.dueDate.split('-');
    } else if (this.dueDate.includes('/')) {
      // Format DD/MM/YYYY
      [day, month, year] = this.dueDate.split('/');
    } else {
      console.error('Format de date non reconnu:', this.dueDate);
      return false;
    }
    
    // Extraction de l'heure et des minutes
    let hours = 0, minutes = 0;
    if (this.dueTime && this.dueTime.includes(':')) {
      [hours, minutes] = this.dueTime.split(':');
    }
    
    // Création de la date d'échéance
    const dueDateTime = new Date(
      parseInt(year), 
      parseInt(month) - 1, 
      parseInt(day), 
      parseInt(hours), 
      parseInt(minutes)
    );
    
    // Vérifier si la date est valide
    if (isNaN(dueDateTime.getTime())) {
      console.error('Date d\'échéance invalide:', this.dueDate, this.dueTime);
      return false;
    }
    
    const now = new Date();
    
    // Calculer la différence en millisecondes
    const diff = dueDateTime.getTime() - now.getTime();
    
    // Notification si le délai est entre 0 et 1 heure
    const result = diff > 0 && diff <= 3600000;
    
    if (result) {
      console.log(`Notification déclenchée pour la tâche "${this.title}" (échéance dans ${Math.round(diff/60000)} minutes)`);
    }
    
    return result;
  } catch (error) {
    console.error('Erreur lors de la vérification de notification:', error);
    return false;
  }
};

module.exports = mongoose.model('Todo', todoSchema); 