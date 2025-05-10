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
    // Initialiser le service d'email
    emailService.initTransporter();

    // Planifier la vérification des tâches toutes les 5 minutes
    // Format: '*/5 * * * *' signifie "toutes les 5 minutes"
    cron.schedule('*/5 * * * *', async () => {
      console.log('Vérification des tâches à notifier...');
      lastNotificationCheck = new Date();
      
      await processNotificationQueue();
      await checkTasksForNotification();
    });

    isRunning = true;
    console.log('Service de notification initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service de notification:', error);
  }
};

// Ajouter une notification à la file d'attente
const queueNotification = (todo) => {
  // Vérifier si cette tâche est déjà dans la file d'attente
  const exists = notificationQueue.some(item => item._id.toString() === todo._id.toString());
  if (!exists) {
    notificationQueue.push({
      _id: todo._id,
      title: todo.title,
      email: todo.notificationEmail,
      dueDate: todo.dueDate,
      dueTime: todo.dueTime,
      attempts: 0,
      lastAttempt: null
    });
    console.log(`Notification ajoutée à la file d'attente pour: ${todo.title}`);
  }
};

// Traiter la file d'attente de notifications
const processNotificationQueue = async () => {
  if (notificationQueue.length === 0) return;
  
  console.log(`Traitement de ${notificationQueue.length} notifications en attente...`);
  
  const now = new Date();
  const remainingQueue = [];
  
  for (const item of notificationQueue) {
    // Limiter à 3 tentatives, avec un délai croissant entre les tentatives
    if (item.attempts >= 3) {
      console.log(`Notification abandonnée après 3 tentatives: ${item.title}`);
      continue;
    }
    
    // Si dernière tentative il y a moins de (attempts * 5) minutes, attendre
    if (item.lastAttempt) {
      const minutesSinceLastAttempt = (now - new Date(item.lastAttempt)) / (1000 * 60);
      if (minutesSinceLastAttempt < (item.attempts * 5)) {
        remainingQueue.push(item);
        continue;
      }
    }
    
    try {
      // Récupérer la tâche à jour depuis la base de données
      const todo = await Todo.findById(item._id);
      
      if (!todo || todo.notificationSent || todo.completed || !todo.notificationsEnabled) {
        console.log(`Notification ignorée (tâche supprimée, déjà envoyée, terminée ou désactivée): ${item.title}`);
        continue;
      }
      
      // Envoyer l'email
      const emailSent = await emailService.sendTaskNotification(todo);
      
      if (emailSent) {
        // Marquer la notification comme envoyée
        todo.notificationSent = true;
        await todo.save();
        console.log(`Notification envoyée avec succès: ${todo.title}`);
      } else {
        // Si échec, incrémenter le compteur de tentatives et ajouter à la file d'attente restante
        item.attempts += 1;
        item.lastAttempt = now;
        remainingQueue.push(item);
        console.log(`Échec de l'envoi de notification (tentative ${item.attempts}): ${item.title}`);
      }
    } catch (error) {
      console.error(`Erreur lors du traitement de la notification: ${error}`);
      item.attempts += 1;
      item.lastAttempt = now;
      remainingQueue.push(item);
    }
  }
  
  notificationQueue = remainingQueue;
  console.log(`${notificationQueue.length} notifications restent dans la file d'attente`);
};

// Vérifier les tâches qui doivent être notifiées
const checkTasksForNotification = async () => {
  try {
    // Vérifier si MongoDB est connecté
    let isMongoConnected = false;
    try {
      isMongoConnected = Todo.db && Todo.db.readyState === 1;
    } catch (error) {
      console.log('MongoDB non connecté, impossible de vérifier les notifications');
      return;
    }

    if (!isMongoConnected) {
      console.log('MongoDB non connecté, impossible de vérifier les notifications');
      return;
    }

    // Récupérer toutes les tâches non complétées avec notifications activées
    const todos = await Todo.find({
      completed: false,
      notificationsEnabled: true,
      notificationSent: false,
      notificationEmail: { $exists: true, $ne: '' }
    });

    console.log(`${todos.length} tâches trouvées avec notifications activées`);

    let updatedCount = 0;
    
    // Vérifier chaque tâche
    for (const todo of todos) {
      if (todo.shouldNotify()) {
        console.log(`Préparation de notification pour la tâche: ${todo.title}`);
        
        // Ajouter à la file d'attente de notifications
        queueNotification(todo);
        updatedCount++;
      }
    }
    
    if (updatedCount > 0) {
      console.log(`${updatedCount} nouvelles notifications ajoutées à la file d'attente`);
    }
    
    // Traiter immédiatement les notifications en attente
    await processNotificationQueue();
    
  } catch (error) {
    console.error('Erreur lors de la vérification des tâches à notifier:', error);
  }
};

// Fonction pour tester l'envoi d'une notification immédiatement
const testNotification = async (todoId, email) => {
  try {
    // Vérifier si MongoDB est connecté
    let isMongoConnected = false;
    try {
      isMongoConnected = Todo.db && Todo.db.readyState === 1;
    } catch (error) {
      console.log('MongoDB non connecté, impossible d\'envoyer la notification de test');
      return { success: false, message: 'Base de données non disponible' };
    }

    if (!isMongoConnected) {
      return { success: false, message: 'Base de données non disponible' };
    }

    // Récupérer la tâche
    const todo = await Todo.findById(todoId);
    
    if (!todo) {
      return { success: false, message: 'Tâche non trouvée' };
    }
    
    // Utiliser l'email fourni ou celui de la tâche
    const testEmail = email || todo.notificationEmail;
    
    if (!testEmail) {
      return { success: false, message: 'Adresse email non spécifiée' };
    }
    
    // Créer une copie de la tâche avec l'email de test
    const testTodo = { ...todo.toObject(), notificationEmail: testEmail };
    
    // Envoyer l'email de test
    const emailSent = await emailService.sendTaskNotification(testTodo);
    
    if (emailSent) {
      return { success: true, message: 'Email de test envoyé avec succès' };
    } else {
      return { success: false, message: 'Échec de l\'envoi de l\'email de test' };
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de test:', error);
    return { success: false, message: 'Erreur lors de l\'envoi de la notification de test' };
  }
};

// Obtenir des statistiques sur le service de notification
const getNotificationStats = () => {
  return {
    isRunning,
    queueLength: notificationQueue.length,
    lastCheck: lastNotificationCheck,
    queuedTasks: notificationQueue.map(item => ({
      title: item.title,
      attempts: item.attempts,
      lastAttempt: item.lastAttempt
    }))
  };
};

module.exports = {
  initNotificationService,
  checkTasksForNotification,
  testNotification,
  getNotificationStats
}; 