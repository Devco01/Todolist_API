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

    // Vérifier si la base de données est accessible
    const { getSequelize } = require('../config/postgres');
    const sequelize = getSequelize();
    
    if (!sequelize) {
      console.warn('[NOTIFICATION-SERVICE] Base de données non disponible, aucune vérification possible');
      return 0;
    }
    
    // Tester la connexion
    try {
      await sequelize.authenticate();
    } catch (authError) {
      console.warn('[NOTIFICATION-SERVICE] Connexion DB non disponible:', authError.message);
      return 0;
    }

    // Récupérer toutes les tâches avec notifications activées
    let todos = [];
    try {
      todos = await todoPgService.getTodosWithPendingNotifications();
      console.log(`${todos.length} tâches trouvées avec notifications activées`);
    } catch (fetchError) {
      console.error('[NOTIFICATION-SERVICE] Erreur lors de la récupération des tâches:', fetchError.message);
      return 0;
    }

    let countReadyForNotification = 0;

    // Vérifier chaque tâche
    for (const todo of todos) {
      try {
        // Si la tâche doit être notifiée, la marquer pour notification
        if (todo.shouldNotify && typeof todo.shouldNotify === 'function' && todo.shouldNotify()) {
          countReadyForNotification++;
          console.log(`Tâche "${todo.title}" prête pour notification (date: ${todo.dueDate}, heure: ${todo.dueTime || '00:00'})`);
        }
      } catch (err) {
        console.error(`Erreur lors de la vérification de la tâche ${todo.id}:`, err.message);
      }
    }

    console.log(`${countReadyForNotification} tâches prêtes pour notification`);
    return countReadyForNotification;
  } catch (error) {
    console.error('[NOTIFICATION-SERVICE] Erreur lors de la vérification des tâches pour notifications:', error.message);
    // Ne pas lancer l'erreur, retourner 0 pour éviter de faire planter l'appelant
    return 0;
  }
};

/**
 * Envoyer les notifications en attente
 */
const sendPendingNotifications = async () => {
  try {
    console.log('Envoi des notifications en attente...');

    // Vérifier si la base de données est accessible
    const { getSequelize } = require('../config/postgres');
    const sequelize = getSequelize();
    
    if (!sequelize) {
      console.warn('[NOTIFICATION-SERVICE] Base de données non disponible, aucun envoi possible');
      return {
        total: 0,
        sent: 0,
        errors: 0,
        details: [],
        note: 'Base de données non disponible'
      };
    }
    
    // Tester la connexion
    try {
      await sequelize.authenticate();
    } catch (authError) {
      console.warn('[NOTIFICATION-SERVICE] Connexion DB non disponible:', authError.message);
      return {
        total: 0,
        sent: 0,
        errors: 0,
        details: [],
        note: 'Connexion DB non disponible'
      };
    }

    // Récupérer toutes les tâches avec notifications activées
    let todos = [];
    try {
      todos = await todoPgService.getTodosWithPendingNotifications();
    } catch (fetchError) {
      console.error('[NOTIFICATION-SERVICE] Erreur lors de la récupération des tâches:', fetchError.message);
      return {
        total: 0,
        sent: 0,
        errors: 1,
        details: [{
          status: 'error',
          message: fetchError.message
        }]
      };
    }
    
    const results = {
      total: todos.length,
      sent: 0,
      errors: 0,
      details: []
    };

    // Filtrer les tâches qui doivent être notifiées
    const todosToNotify = todos.filter(todo => todo.shouldNotify && todo.shouldNotify());
    
    if (todosToNotify.length === 0) {
      console.log('Aucune tâche à notifier aujourd\'hui');
      return {
        total: 0,
        sent: 0,
        errors: 0,
        details: []
      };
    }
    
    console.log(`${todosToNotify.length} tâches à notifier aujourd'hui`);

    const todosByEmail = {};

    todosToNotify.forEach((todo) => {
      if (!todo.notificationEmail) return;

      if (!todosByEmail[todo.notificationEmail]) {
        todosByEmail[todo.notificationEmail] = [];
      }

      todosByEmail[todo.notificationEmail].push(todo);
    });
    
    // Envoyer un email par adresse avec toutes les tâches regroupées
    for (const [email, emailTodos] of Object.entries(todosByEmail)) {
      try {
        // Nombre de tâches pour cette adresse
        const todoCount = emailTodos.length;
        
        // Trier les tâches par date puis heure
        emailTodos.sort((a, b) => {
          // D'abord par date
          if (a.dueDate < b.dueDate) return -1;
          if (a.dueDate > b.dueDate) return 1;
          
          // Si même date, trier par heure
          const aTime = a.dueTime || '00:00';
          const bTime = b.dueTime || '00:00';
          return aTime.localeCompare(bTime);
        });
        
        // Titre de l'email
        const subject = todoCount === 1 
          ? `📅 Rappel : "${emailTodos[0].title}" aujourd'hui`
          : `📅 Rappel : ${todoCount} tâches prévues aujourd'hui`;
        
        // Construire le tableau HTML des tâches
        let tasksTableHtml = `
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f9f9f9;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Tâche</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Heure</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Priorité</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Catégorie</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        // Liste des tâches en format texte
        let tasksTextList = '';
        
        // Générer chaque ligne du tableau
        emailTodos.forEach((todo, index) => {
          const priorityColor = todo.priority === 'high' ? '#bc4749' : (todo.priority === 'medium' ? '#d9a557' : '#588157');
          const priorityLabel = todo.priority === 'high' ? 'Haute' : (todo.priority === 'medium' ? 'Moyenne' : 'Basse');
          
          // Formater l'heure pour l'affichage
          const formattedTime = todo.dueTime || '00:00';
          
          // Formater la date si nécessaire
          let formattedDate = todo.dueDate;
          if (todo.dueDate && todo.dueDate.includes('-')) {
            const [year, month, day] = todo.dueDate.split('-');
            const date = new Date(year, month - 1, day);
            formattedDate = date.toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            });
          }
          
          tasksTableHtml += `
            <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'}; border-bottom: 1px solid #ddd;">
              <td style="padding: 10px;">
                <strong>${todo.title}</strong>
                ${todo.description ? `<br><span style="color: #666; font-size: 0.9em;">${todo.description}</span>` : ''}
              </td>
              <td style="padding: 10px;">${formattedTime}</td>
              <td style="padding: 10px;"><span style="color: ${priorityColor};">${priorityLabel}</span></td>
              <td style="padding: 10px;">${todo.category || 'Non spécifiée'}</td>
            </tr>
          `;
          
          // Ajouter à la liste texte
          tasksTextList += `
- ${todo.title} à ${formattedTime}
  Priorité: ${priorityLabel}
  Catégorie: ${todo.category || 'Non spécifiée'}
  ${todo.description ? `Description: ${todo.description}` : ''}
`;
        });
        
        tasksTableHtml += `
            </tbody>
          </table>
        `;
        
        // Construire le contenu de l'email
        const emailData = {
          to: email,
          subject: subject,
          text: `
Bonjour,

Voici un rappel pour vos tâches prévues aujourd'hui (${new Date().toLocaleDateString('fr-FR')}) :

${tasksTextList}

Cordialement,
Votre application TodoList
          `.trim(),
          html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <h2 style="color: #4a7c59;">Rappel de tâches pour aujourd'hui</h2>
  <p>Bonjour,</p>
  <p>Voici un résumé de vos tâches prévues pour aujourd'hui (${new Date().toLocaleDateString('fr-FR')}) :</p>
  
  ${tasksTableHtml}
  
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
  <p style="font-size: 0.9rem; color: #666;">
    Cordialement,<br>
    Votre application TodoList<br>
    <em>Ne répondez pas à cet email, il a été envoyé automatiquement.</em>
  </p>
</div>
          `.trim()
        };

        const emailResult = await emailService.sendEmail(emailData);

        if (emailResult.success) {
          for (const todo of emailTodos) {
            await todoPgService.markNotificationSent(todo.id);
          }

          console.log(`Notification groupée envoyée pour ${todoCount} tâches à ${email}`);

          results.sent++;
          results.details.push({
            email,
            todoCount,
            todos: emailTodos.map((t) => ({ id: t.id, title: t.title })),
            status: 'success',
            messageId: emailResult.messageId || '',
            previewUrl: emailResult.previewUrl || ''
          });
        } else {
          throw new Error(emailResult.message || "Échec de l'envoi de l'email");
        }
      } catch (err) {
        console.error(`Erreur lors de l'envoi de la notification groupée à ${email}:`, err);
        results.errors++;
        results.details.push({
          email: email,
          todoCount: todosByEmail[email].length,
          status: 'error',
          message: err.message
        });
      }
    }

    console.log(`Résultat de l'envoi des notifications: ${results.sent} emails envoyés, ${results.errors} erreurs`);
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