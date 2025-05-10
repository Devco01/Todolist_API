const mongoose = require('mongoose');

// Schéma pour enregistrer l'historique des notifications envoyées
const notificationLogSchema = new mongoose.Schema({
  todoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Todo',
    required: true
  },
  todoTitle: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failure'],
    required: true
  },
  messageId: String,
  previewUrl: String,
  error: String,
  sentAt: {
    type: Date,
    default: Date.now
  },
  // Informations sur l'environnement
  environment: {
    type: String,
    enum: ['development', 'production'],
    default: 'production'
  },
  // Type de notification
  notificationType: {
    type: String,
    enum: ['reminder', 'urgent', 'test'],
    default: 'reminder'
  }
});

// Index pour améliorer les performances des requêtes
notificationLogSchema.index({ todoId: 1 });
notificationLogSchema.index({ email: 1 });
notificationLogSchema.index({ sentAt: -1 });
notificationLogSchema.index({ status: 1 });

// Méthodes statiques
notificationLogSchema.statics.getRecentLogs = async function(limit = 100) {
  return this.find()
    .sort({ sentAt: -1 })
    .limit(limit)
    .populate('todoId', 'title dueDate dueTime');
};

notificationLogSchema.statics.getStatistics = async function() {
  // Aggrégation pour obtenir des statistiques sur les notifications
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        mostRecentDate: { $max: "$sentAt" }
      }
    }
  ]);
  
  // Calculer le taux de réussite
  const totalCount = stats.reduce((acc, stat) => acc + stat.count, 0);
  const successCount = stats.find(s => s._id === 'success')?.count || 0;
  const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  
  return {
    total: totalCount,
    success: successCount,
    failure: totalCount - successCount,
    successRate: Math.round(successRate * 100) / 100,  // Arrondi à 2 décimales
    stats
  };
};

module.exports = mongoose.model('NotificationLog', notificationLogSchema); 