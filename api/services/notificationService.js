const cron = require('node-cron');
const Todo = require('../models/Todo');
const emailService = require('./emailService');

let isRunning = false;

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
      await checkTasksForNotification();
    });

    isRunning = true;
    console.log('Service de notification initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service de notification:', error);
  }
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

    // Vérifier chaque tâche
    for (const todo of todos) {
      if (todo.shouldNotify()) {
        console.log(`Envoi de notification pour la tâche: ${todo.title}`);
        
        // Envoyer l'email de notification
        const emailSent = await emailService.sendTaskNotification(todo);
        
        if (emailSent) {
          // Marquer la notification comme envoyée
          todo.notificationSent = true;
          await todo.save();
          console.log(`Notification envoyée pour la tâche: ${todo.title}`);
        }
      }
    }
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

module.exports = {
  initNotificationService,
  checkTasksForNotification,
  testNotification
}; 