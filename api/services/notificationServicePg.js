const cron = require('node-cron');
const config = require('../config/config');
const emailService = require('./emailService');
const todoPgService = require('./todoPgService');

// Variables de suivi
let notificationServiceActive = false;
let cronJob = null;

/**
 * Initialiser le service de notification avec cron
 */
const initNotificationService = () => {
  // Si le service est déjà actif, ne pas le réinitialiser
  if (notificationServiceActive) {
    console.log('Service de notification déjà actif');
    return;
  }

  console.log('Initialisation du service de notification avec PostgreSQL');

  try {
    // Sur Vercel, on ne doit pas créer de cron localement
    if (process.env.VERCEL === '1') {
      console.log('Environnement Vercel détecté - Les notifications seront gérées par Vercel Cron');
      notificationServiceActive = true;
      return;
    }

    // Configuration du cron en fonction de l'environnement
    const cronSchedule = config.notifications.checkFrequency;
    console.log(`Configuration du cron: "${cronSchedule}"`);

    // Créer une tâche cron
    cronJob = cron.schedule(cronSchedule, async () => {
      try {
        console.log('Exécution du cron de vérification des notifications');
        await checkTasksForNotification();
        await sendPendingNotifications();
      } catch (error) {
        console.error('Erreur lors de l\'exécution du cron de notification:', error);
      }
    });

    notificationServiceActive = true;
    console.log('Service de notification initialisé avec succès');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service de notification:', error);
  }
};

/**
 * Arrêter le service de notification
 */
const stopNotificationService = () => {
  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }
  notificationServiceActive = false;
  console.log('Service de notification arrêté');
};

/**
 * Vérifier les tâches pour les notifications
 */
const checkTasksForNotification = async () => {
  try {
    console.log('Vérification des tâches pour les notifications (échéance dans les prochaines 24h)...');

    // Récupérer toutes les tâches avec notifications activées
    const todos = await todoPgService.getTodosWithPendingNotifications();
    console.log(`${todos.length} tâches trouvées avec notifications activées`);

    let countReadyForNotification = 0;

    // Vérifier chaque tâche
    for (const todo of todos) {
      try {
        // Si la tâche doit être notifiée, la marquer pour notification
        if (todo.shouldNotify && todo.shouldNotify()) {
          countReadyForNotification++;
          console.log(`Tâche "${todo.title}" prête pour notification (date: ${todo.dueDate}, heure: ${todo.dueTime || '00:00'})`);
        }
      } catch (err) {
        console.error(`Erreur lors de la vérification de la tâche ${todo.id}:`, err);
      }
    }

    console.log(`${countReadyForNotification} tâches prêtes pour notification`);
    return countReadyForNotification;
  } catch (error) {
    console.error('Erreur lors de la vérification des tâches pour notifications:', error);
    throw error;
  }
};

/**
 * Envoyer les notifications en attente
 */
const sendPendingNotifications = async () => {
  try {
    console.log('Envoi des notifications en attente...');

    // Récupérer toutes les tâches avec notifications activées
    const todos = await todoPgService.getTodosWithPendingNotifications();
    
    const results = {
      total: todos.length,
      sent: 0,
      errors: 0,
      details: []
    };

    for (const todo of todos) {
      try {
        if (todo.shouldNotify && todo.shouldNotify()) {
          // Construire le contenu de l'email
          const emailData = {
            to: todo.notificationEmail,
            subject: `Rappel: "${todo.title}" - Tâche à effectuer bientôt`,
            text: `
              Bonjour,
              
              Ceci est un rappel pour votre tâche "${todo.title}" qui doit être effectuée le ${todo.dueDate} à ${todo.dueTime || '00:00'}.
              
              Description: ${todo.description || 'Aucune description'}
              Catégorie: ${todo.category || 'Non spécifiée'}
              Priorité: ${todo.priority || 'Moyenne'}
              
              Cordialement,
              Votre application TodoList
            `.replace(/              /g, '').trim(),
            html: `
              <h2>Rappel : Tâche à effectuer bientôt</h2>
              <h3>${todo.title}</h3>
              <p>Date d'échéance : <strong>${todo.dueDate}</strong> à <strong>${todo.dueTime || '00:00'}</strong></p>
              
              <h4>Détails :</h4>
              <p><strong>Description :</strong> ${todo.description || 'Aucune description'}</p>
              <p><strong>Catégorie :</strong> ${todo.category || 'Non spécifiée'}</p>
              <p><strong>Priorité :</strong> ${todo.priority || 'Moyenne'}</p>
              
              <hr>
              <p style="color: #666; font-size: 0.8em;">Ce message a été envoyé automatiquement par votre application TodoList</p>
            `.replace(/              /g, '').trim()
          };

          // Envoyer l'email via la fonction sendTaskNotification pour bénéficier de la mise en forme avancée
          const emailResult = await emailService.sendTaskNotification(todo);
          
          // Marquer la notification comme envoyée seulement si l'envoi a réussi
          if (emailResult.success) {
            await todoPgService.markNotificationSent(todo.id);
            
            console.log(`Notification envoyée pour "${todo.title}" à ${todo.notificationEmail}`);
            
            results.sent++;
            results.details.push({
              todoId: todo.id,
              title: todo.title,
              email: todo.notificationEmail,
              status: 'success',
              messageId: emailResult.messageId || '',
              previewUrl: emailResult.previewUrl || ''
            });
          } else {
            throw new Error(emailResult.message || 'Échec de l\'envoi de l\'email');
          }
        }
      } catch (err) {
        console.error(`Erreur lors de l'envoi de la notification pour la tâche ${todo.id}:`, err);
        results.errors++;
        results.details.push({
          todoId: todo.id,
          title: todo.title,
          email: todo.notificationEmail,
          status: 'error',
          message: err.message
        });
      }
    }

    console.log(`Résultat de l'envoi des notifications: ${results.sent} envoyées, ${results.errors} erreurs`);
    return results;
  } catch (error) {
    console.error('Erreur lors de l\'envoi des notifications:', error);
    throw error;
  }
};

/**
 * Envoyer un email de test pour une tâche
 */
const sendTestNotification = async (todoId, testEmail) => {
  try {
    // Récupérer la tâche
    const todo = await todoPgService.getTodoById(todoId);
    
    if (!todo) {
      throw new Error('Tâche non trouvée');
    }
    
    // Construire le contenu de l'email
    const emailData = {
      to: testEmail || todo.notificationEmail,
      subject: `[TEST] Rappel: "${todo.title}" - Tâche à effectuer bientôt`,
      text: `
        Bonjour,
        
        Ceci est un email de TEST pour votre tâche "${todo.title}" qui doit être effectuée le ${todo.dueDate} à ${todo.dueTime || '00:00'}.
        
        Description: ${todo.description || 'Aucune description'}
        Catégorie: ${todo.category || 'Non spécifiée'}
        Priorité: ${todo.priority || 'Moyenne'}
        
        Cordialement,
        Votre application TodoList
      `.replace(/        /g, '').trim(),
      html: `
        <h2>[TEST] Rappel : Tâche à effectuer bientôt</h2>
        <h3>${todo.title}</h3>
        <p>Date d'échéance : <strong>${todo.dueDate}</strong> à <strong>${todo.dueTime || '00:00'}</strong></p>
        
        <h4>Détails :</h4>
        <p><strong>Description :</strong> ${todo.description || 'Aucune description'}</p>
        <p><strong>Catégorie :</strong> ${todo.category || 'Non spécifiée'}</p>
        <p><strong>Priorité :</strong> ${todo.priority || 'Moyenne'}</p>
        
        <hr>
        <p style="color: #666; font-size: 0.8em;">Ceci est un email de TEST envoyé manuellement depuis votre application TodoList</p>
      `.replace(/        /g, '').trim()
    };
    
    // Envoyer l'email
    const result = await emailService.sendEmail(emailData);
    
    console.log(`Email de test envoyé pour "${todo.title}" à ${emailData.to}`);
    
    return {
      success: true,
      message: `Email de test envoyé à ${emailData.to}`,
      todo: {
        id: todo.id,
        title: todo.title
      }
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email de test:`, error);
    throw error;
  }
};

/**
 * Tester la connexion SMTP sans utiliser une tâche existante
 */
const testSmtpConnection = async (targetEmail) => {
  try {
    // Valider l'email
    if (!targetEmail || !targetEmail.includes('@')) {
      throw new Error('Adresse email invalide');
    }
    
    console.log(`Envoi d'un email de test à ${targetEmail}...`);
    
    // Créer une tâche fictive pour le test
    const testTodo = {
      title: 'Test de connexion SMTP',
      description: 'Ceci est un email de test pour vérifier la configuration de votre service de notification',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      notificationEmail: targetEmail,
      notificationsEnabled: true,
      priority: 'medium',
      category: 'autre'
    };
    
    // Essayer de réinitialiser le transporteur avant le test
    await emailService.initializeEmailTransporter();
    
    // Envoyer l'email de test
    console.log('Envoi du test avec la tâche fictive:', JSON.stringify(testTodo, null, 2));
    const result = await emailService.sendTaskNotification(testTodo);
    
    console.log('Résultat de l\'envoi de test:', JSON.stringify(result, null, 2));
    
    if (result.previewUrl) {
      console.log('==============================================');
      console.log('PRÉVISUALISATION DE L\'EMAIL DISPONIBLE:');
      console.log(result.previewUrl);
      console.log('==============================================');
    }
    
    return {
      success: result.success,
      message: `Email de test envoyé à ${targetEmail}`,
      details: result
    };
  } catch (error) {
    console.error(`Erreur lors du test SMTP:`, error);
    throw error;
  }
};

/**
 * Vérifier si le service de notification est actif
 */
const isServiceActive = () => {
  return notificationServiceActive;
};

module.exports = {
  initNotificationService,
  stopNotificationService,
  checkTasksForNotification,
  sendPendingNotifications,
  sendTestNotification,
  testSmtpConnection,
  isServiceActive
}; 