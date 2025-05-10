const cron = require('node-cron');
const Todo = require('../models/Todo');
const emailService = require('./emailService');
const { saveBackupTodos } = require('../config/db');

let isRunning = false;
let notificationQueue = [];
let lastNotificationCheck = null;

// Initialiser le service de notification
const initNotificationService = () => {
  if (isRunning) {
    console.log('Le service de notification est déjà en cours d\'exécution');
    return;
  }

  try {
    // Planifier la vérification des tâches toutes les minutes (pour plus de précision)
    // Format: '* * * * *' signifie "chaque minute"
    cron.schedule('* * * * *', async () => {
      const now = new Date();
      console.log(`Vérification des tâches à notifier... ${now.toISOString()}`);
      lastNotificationCheck = now;
      
      await sendPendingNotifications();
      await checkTasksForNotification();
    });

    isRunning = true;
    console.log('Service de notification initialisé avec succès');
    
    // Exécuter immédiatement une première vérification
    setTimeout(async () => {
      console.log('Première vérification des tâches à notifier...');
      await checkTasksForNotification();
    }, 5000);
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
      console.log('MongoDB non connecté, notification ignorée');
      return;
    }

    if (!isMongoConnected) {
      console.log('Base de données non disponible, notification ignorée');
      return;
    }

    // Récupérer toutes les tâches actives avec notifications activées mais pas encore envoyées
    const todos = await Todo.find({
      completed: false,
      notificationsEnabled: true,
      notificationSent: false
    });

    if (todos.length === 0) {
      console.log('Aucune tâche avec notification activée');
      return;
    }

    console.log(`Vérification de ${todos.length} tâches pour notifications...`);
    
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
      console.log(`${tasksToNotify} tâche(s) ajoutée(s) à la file d'attente de notification`);
      // Traiter immédiatement la file d'attente
      await sendPendingNotifications();
    } else {
      console.log('Aucune tâche à notifier pour le moment');
    }
  } catch (error) {
    console.error('Erreur lors de la vérification des tâches à notifier:', error);
  }
};

// Traiter les notifications en attente
const sendPendingNotifications = async () => {
  if (notificationQueue.length === 0) {
    return;
  }
  
  console.log(`Traitement de ${notificationQueue.length} notification(s) en attente...`);
  
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
      
      // Vérifier si la notification doit être envoyée
      if (!todo.notificationsEnabled || todo.notificationSent || todo.completed) {
        console.log(`Tâche ${todoId} ne nécessite plus de notification`);
        return { id: todoId, success: false };
      }
      
      // Envoyer la notification
      const result = await emailService.sendTaskNotification(todo);
      
      // Même si pas d'envoi direct, on considère la notification comme envoyée
      if (result.success) {
        // Mettre à jour la tâche pour indiquer que la notification a été envoyée
        todo.notificationSent = true;
        await todo.save();
        
        console.log(`Notification traitée pour la tâche "${todo.title}"`);
        return { id: todoId, success: true };
      } else {
        console.error(`Échec d'envoi de notification pour ${todoId}: ${result.message}`);
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

// Obtenir les statistiques du service de notification
const getNotificationStats = () => {
  return {
    isRunning,
    lastCheck: lastNotificationCheck,
    pendingNotifications: notificationQueue.length
  };
};

// Fonction pour tester l'envoi d'une notification
const testNotification = async (todoId, email) => {
  try {
    return await emailService.testNotification(todoId, email);
  } catch (error) {
    console.error('Erreur lors du test de notification:', error);
    return { success: false, message: 'Erreur lors de l\'envoi de la notification de test' };
  }
};

module.exports = {
  initNotificationService,
  checkTasksForNotification,
  getNotificationStats,
  testNotification
}; 