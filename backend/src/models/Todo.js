const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    required: true,
    enum: ['maison', 'courses', 'santé', 'famille', 'autre'],
    default: 'autre'
  },
  completed: {
    type: Boolean,
    default: false
  },
  dueDate: {
    type: String,
    default: null
  },
  dueTime: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware pour formater l'heure avant la sauvegarde
todoSchema.pre('save', function(next) {
  if (this.dueTime) {
    // Assure que l'heure est au format HH:mm
    const [hours, minutes] = this.dueTime.split(':');
    this.dueTime = `${hours.padStart(2, '0')}:${minutes}`;
  }
  next();
});

module.exports = mongoose.model('Todo', todoSchema); 