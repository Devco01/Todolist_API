const cron = require('node-cron');
const Todo = require('../models/Todo');
const emailService = require('./emailService');
const { saveBackupTodos } = require('../config/db');

let isRunning = false;
let notificationQueue = [];
let lastNotificationCheck = null;
let debugMode = true; // Activer les logs détaillés

// Initialiser le service de notification
const initNotificationService = () => {
  if (isRunning) {
    console.log('Le service de notification est déjà en cours d\'exécution');
    return;
  }

  try {
    // Planifier la vérification des tâches plus fréquemment (toutes les 30 secondes)
    // Format: '*/30 * * * * *' signifie "toutes les 30 secondes"
    cron.schedule('*/30 * * * * *', async () => {
      const now = new Date();
      console.log(`🔍 Vérification des tâches à notifier... ${now.toISOString()}`);
      lastNotificationCheck = now;
      
      await sendPendingNotifications();
      await checkTasksForNotification();
    });

    isRunning = true;
    console.log('✅ Service de notification initialisé avec succès');
    
    // Exécuter immédiatement une première vérification
    setTimeout(async () => {
      console.log('🚀 Première vérification des tâches à notifier...');
      await checkTasksForNotification();
    }, 3000);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service de notification:', error);
  }
};

// Vérifier les tâches qui nécessitent une notification
const checkTasksForNotification = async () => {
  try {
    // Vérifier si MongoDB est connecté
    let isMongoConnected = false;
    try {
      isMongoConnected = Todo.db && Todo.db.readyState === 1;
    } catch (error) {
      console.log('MongoDB non connecté, utilisation du stockage local');
      return;
    }

    if (!isMongoConnected) {
      console.log('Base de données non disponible, notification ignorée');
      return;
    }

    if (debugMode) {
      console.log('Recherche de tâches avec notifications activées...');
    }

    // Récupérer toutes les tâches actives avec notifications activées
    // Ne plus filtrer sur notificationSent=false pour permettre la vérification continue
    const todos = await Todo.find({
      completed: false,
      notificationsEnabled: true,
      notificationEmail: { $exists: true, $ne: "" }
    });

    if (todos.length === 0) {
      if (debugMode) console.log('Aucune tâche avec notification activée');
      return;
    }

    console.log(`📋 Vérification de ${todos.length} tâches pour notifications...`);
    
    let tasksToNotify = 0;

    for (const todo of todos) {
      // Vérifier si cette tâche devrait être notifiée maintenant
      if (todo.shouldNotify()) {
        // Ajouter à la file d'attente de notification
        if (!notificationQueue.includes(todo._id.toString())) {
          notificationQueue.push(todo._id.toString());
          tasksToNotify++;
        }
      }
    }

    if (tasksToNotify > 0) {
      console.log(`🔔 ${tasksToNotify} tâche(s) ajoutée(s) à la file d'attente de notification`);
      // Traiter immédiatement la file d'attente
      await sendPendingNotifications();
    } else if (debugMode) {
      console.log('Aucune tâche à notifier pour le moment');
    }
  } catch (error) {
    console.error('⚠️ Erreur lors de la vérification des tâches à notifier:', error);
  }
};

// Traiter les notifications en attente
const sendPendingNotifications = async () => {
  if (notificationQueue.length === 0) {
    return;
  }
  
  console.log(`📤 Traitement de ${notificationQueue.length} notification(s) en attente...`);
  
  const promises = notificationQueue.map(async (todoId) => {
    try {
      let todo = null;
      
      // Tenter de récupérer la tâche de MongoDB
      if (Todo.db && Todo.db.readyState === 1) {
        todo = await Todo.findById(todoId);
      }
      
      if (!todo) {
        console.log(`Tâche ${todoId} non trouvée, suppression de la file d'attente`);
        return { id: todoId, success: false };
      }
      
      // Vérifier si la notification doit encore être envoyée
      if (todo.completed) {
        console.log(`Tâche ${todoId} terminée, pas besoin de notification`);
        return { id: todoId, success: false };
      }
      
      // Si notification déjà envoyée, vérifier quand même si on est très proche de l'échéance
      if (todo.notificationSent) {
        // Vérifier si la tâche est à moins de 15 min de l'échéance
        const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`);
        const now = new Date();
        const diffMinutes = Math.round((dueDate - now) / 60000);
        
        // Si pas dans la fenêtre d'urgence (<15min), ne pas renvoyer
        if (diffMinutes > 15 || diffMinutes < 0) {
          return { id: todoId, success: false };
        }
        
        console.log(`⚠️ Rappel urgent pour "${todo.title}" - Échéance dans ${diffMinutes} minutes!`);
      }
      
      // Envoyer la notification
      const result = await emailService.sendTaskNotification(todo);
      
      if (result.success) {
        // Mettre à jour la tâche pour indiquer que la notification a été envoyée
        todo.notificationSent = true;
        await todo.save();
        
        console.log(`✅ Notification envoyée pour "${todo.title}" à ${todo.notificationEmail}`);
        return { id: todoId, success: true };
      } else {
        console.error(`❌ Échec d'envoi de notification pour "${todo.title}": ${result.message}`);
        return { id: todoId, success: false };
      }
    } catch (error) {
      console.error(`Erreur lors du traitement de la notification ${todoId}:`, error);
      return { id: todoId, success: false };
    }
  });
  
  const results = await Promise.all(promises);
  
  // Supprimer les notifications envoyées avec succès de la file d'attente
  const successIds = results.filter(r => r.success).map(r => r.id);
  notificationQueue = notificationQueue.filter(id => !successIds.includes(id));
  
  console.log(`${successIds.length} notification(s) traitée(s) avec succès, ${notificationQueue.length} notification(s) restante(s)`);
};

// Obtenir les statistiques de notification
const getNotificationStats = () => {
  return {
    isRunning,
    queueLength: notificationQueue.length,
    lastCheck: lastNotificationCheck ? lastNotificationCheck.toISOString() : null
  };
};

module.exports = {
  initNotificationService,
  checkTasksForNotification,
  getNotificationStats
}; 