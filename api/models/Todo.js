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
  if (!this.notificationsEnabled || this.notificationSent || this.completed) {
    return false;
  }
  
  if (!this.notificationEmail) {
    return false;
  }
  
  if (!this.dueDate || !this.dueTime) {
    return false;
  }
  
  const [day, month, year] = this.dueDate.split('/');
  const [hours, minutes] = this.dueTime.split(':');
  
  const dueDateTime = new Date(
    parseInt(year), 
    parseInt(month) - 1, 
    parseInt(day), 
    parseInt(hours), 
    parseInt(minutes)
  );
  
  const now = new Date();
  
  const diff = dueDateTime.getTime() - now.getTime();
  
  return diff > 0 && diff <= 3600000;
};

module.exports = mongoose.model('Todo', todoSchema); 