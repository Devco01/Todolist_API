const cron = require('node-cron');
const Todo = require('../models/Todo');
const NotificationLog = require('../models/NotificationLog');
const emailService = require('./emailService');
const { saveBackupTodos } = require('../config/db');
const config = require('../config/config');

let isRunning = false;
let notificationQueue = [];
let lastNotificationCheck = null;
let debugMode = config.notifications.debugMode;

// Gestion des erreurs et récupération en cas de problème
let errorCount = 0;
const MAX_ERRORS = 5;

// Initialiser le service de notification
const initNotificationService = () => {
  if (isRunning) {
    console.log('Le service de notification est déjà en cours d\'exécution');
    return;
  }

  try {
    // En mode Vercel, nous n'utilisons pas directement le cron
    // Les tâches cron seront gérées par Vercel Cron
    if (!process.env.VERCEL) {
      // Planifier la vérification des tâches selon la fréquence configurée
      cron.schedule(config.notifications.checkFrequency, async () => {
        const now = new Date();
        console.log(`🔍 Vérification des tâches à notifier... ${now.toISOString()}`);
        lastNotificationCheck = now;
        
        try {
          await sendPendingNotifications();
          await checkTasksForNotification();
        } catch (error) {
          console.error('Erreur lors de la vérification des notifications:', error);
          
          // Gestion des erreurs successives
          errorCount++;
          if (errorCount >= MAX_ERRORS) {
            console.error(`Trop d'erreurs (${errorCount}), tentative de réinitialisation du service...`);
            resetNotificationService();
          }
        }
      });
      
      console.log(`✅ Service de notification planifié avec cron: ${config.notifications.checkFrequency}`);
    } else {
      console.log('Mode Vercel détecté: les tâches cron seront gérées par Vercel Cron Jobs');
    }

    isRunning = true;
    console.log(`✅ Service de notification initialisé avec succès (mode: ${config.isProduction ? 'production' : 'développement'})`);
    
    // Exécuter immédiatement une première vérification (sauf en mode Vercel)
    if (!process.env.VERCEL) {
      setTimeout(async () => {
        console.log('🚀 Première vérification des tâches à notifier...');
        try {
          await checkTasksForNotification();
        } catch (error) {
          console.error('Erreur lors de la première vérification:', error);
        }
      }, 5000);
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service de notification:', error);
  }
};

// Réinitialiser le service en cas de problèmes
const resetNotificationService = async () => {
  try {
    // Vider la file d'attente
    notificationQueue = [];
    errorCount = 0;
    
    // Tenter de rafraîchir la connexion email
    if (emailService.refreshTransporter) {
      await emailService.refreshTransporter();
    }
    
    console.log('Service de notification réinitialisé');
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du service:', error);
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
      console.log('MongoDB non connecté ou inaccessible');
    }

    if (!isMongoConnected) {
      console.log('Base de données non disponible, notification ignorée');
      return;
    }

    if (debugMode) {
      console.log('Recherche de tâches avec notifications activées...');
    }

    // Récupérer toutes les tâches actives avec notifications activées
    // Ne plus filtrer sur notificationSent pour permettre les rappels d'urgence
    const todos = await Todo.find({
      completed: false,
      notificationsEnabled: true,
      notificationEmail: { $exists: true, $ne: "" },
      // Optimisation: ne rechercher que les tâches à échéance de moins de 24h
      dueDate: { 
        $exists: true, 
        $ne: "" 
      }
    }).limit(100); // Limiter pour éviter les surcharges

    if (todos.length === 0) {
      if (debugMode) console.log('Aucune tâche avec notification activée');
      return;
    }

    console.log(`📋 Vérification de ${todos.length} tâches pour notifications...`);
    
    // Filtrer les tâches avec dates proches (optimisation)
    const filteredTodos = todos.filter(todo => {
      try {
        // Créer la date d'échéance
        const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`);
        const now = new Date();
        const diffHours = (dueDate - now) / 3600000;
        
        // Ne garder que les tâches avec échéance dans les prochaines 24h
        return !isNaN(dueDate.getTime()) && diffHours > 0 && diffHours < 24;
      } catch (e) {
        return false;
      }
    });
    
    if (debugMode) console.log(`${filteredTodos.length} tâches ont une échéance dans les prochaines 24h`);
    
    let tasksToNotify = 0;

    for (const todo of filteredTodos) {
      // Vérifier si cette tâche devrait être notifiée maintenant
      if (todo.shouldNotify()) {
        // Éviter les doublons dans la file d'attente
        const todoId = todo._id.toString();
        if (!notificationQueue.includes(todoId)) {
          notificationQueue.push(todoId);
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
    
    // Réinitialiser le compteur d'erreurs car tout s'est bien passé
    errorCount = 0;
  } catch (error) {
    console.error('⚠️ Erreur lors de la vérification des tâches à notifier:', error);
    throw error; // Propager l'erreur pour la gestion d'erreurs supérieure
  }
};

// Traiter les notifications en attente
const sendPendingNotifications = async () => {
  if (notificationQueue.length === 0) {
    return;
  }
  
  console.log(`📤 Traitement de ${notificationQueue.length} notification(s) en attente...`);
  
  // Limiter le nombre de notifications à traiter à la fois pour éviter les surcharges
  const batchSize = 5;
  const currentBatch = notificationQueue.slice(0, batchSize);
  
  const promises = currentBatch.map(async (todoId) => {
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
      const isUrgentReminder = todo.notificationSent && todo.shouldNotify();
      
      if (todo.notificationSent && !isUrgentReminder) {
        return { id: todoId, success: false, message: "Notification déjà envoyée et pas besoin de rappel urgent" };
      }
      
      // Ajouter un petit délai entre chaque envoi pour éviter les limitations de débit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Déterminer le type de notification
      const notificationType = isUrgentReminder ? 'urgent' : 'reminder';
      
      // Envoyer la notification
      const result = await emailService.sendTaskNotification(todo);
      
      // Enregistrer le résultat dans les logs MongoDB
      try {
        await NotificationLog.create({
          todoId: todo._id,
          todoTitle: todo.title,
          email: todo.notificationEmail,
          status: result.success ? 'success' : 'failure',
          messageId: result.messageId,
          previewUrl: result.previewUrl,
          error: result.success ? null : result.message,
          environment: config.env,
          notificationType
        });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement du log de notification:', logError);
      }
      
      if (result.success) {
        // Mettre à jour la tâche pour indiquer que la notification a été envoyée
        todo.notificationSent = true;
        await todo.save();
        
        console.log(`✅ Notification envoyée pour "${todo.title}" à ${todo.notificationEmail}`);
        
        if (result.previewUrl) {
          console.log(`📨 Prévisualisation: ${result.previewUrl}`);
        }
        
        return { id: todoId, success: true };
      } else {
        console.error(`❌ Échec d'envoi de notification pour "${todo.title}": ${result.message}`);
        return { id: todoId, success: false, error: result.message };
      }
    } catch (error) {
      console.error(`Erreur lors du traitement de la notification ${todoId}:`, error);
      return { id: todoId, success: false, error: error.message };
    }
  });
  
  try {
    const results = await Promise.all(promises);
    
    // Supprimer les notifications envoyées avec succès ou impossibles de la file d'attente
    const processedIds = results.map(r => r.id);
    notificationQueue = notificationQueue.filter(id => !processedIds.includes(id));
    
    const successCount = results.filter(r => r.success).length;
    console.log(`${successCount} notification(s) traitée(s) avec succès, ${notificationQueue.length} notification(s) restante(s)`);
    
    return { success: successCount > 0, processed: results.length };
  } catch (error) {
    console.error('Erreur lors du traitement des notifications en attente:', error);
    return { success: false, error: error.message };
  }
};

// Obtenir les statistiques de notification
const getNotificationStats = async () => {
  const baseStats = {
    isRunning,
    queueLength: notificationQueue.length,
    lastCheck: lastNotificationCheck ? lastNotificationCheck.toISOString() : null,
    errorCount,
    debugMode
  };
  
  // Essayer d'obtenir des statistiques détaillées depuis MongoDB
  try {
    if (NotificationLog.db && NotificationLog.db.readyState === 1) {
      const dbStats = await NotificationLog.getStatistics();
      return {
        ...baseStats,
        logs: dbStats
      };
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques détaillées:', error);
  }
  
  return baseStats;
};

// Fonction pour activer/désactiver le mode debug
const setDebugMode = (enabled) => {
  debugMode = enabled;
  console.log(`Mode débogage ${enabled ? 'activé' : 'désactivé'}`);
  return { debugMode };
};

// Obtenir l'historique des notifications récentes
const getNotificationHistory = async (limit = 50) => {
  try {
    if (NotificationLog.db && NotificationLog.db.readyState === 1) {
      return await NotificationLog.getRecentLogs(limit);
    }
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des notifications:', error);
    return [];
  }
};

module.exports = {
  initNotificationService,
  checkTasksForNotification,
  getNotificationStats,
  getNotificationHistory,
  sendPendingNotifications,
  setDebugMode,
  resetNotificationService
}; 