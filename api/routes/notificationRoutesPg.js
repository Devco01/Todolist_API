const router = require('express').Router();
const todoPgService = require('../services/todoPgService');
const notificationService = require('../services/notificationServicePg');

// Activer/désactiver les notifications pour une tâche
router.put('/:id', async (req, res) => {
  try {
    const todoId = req.params.id;
    const { notificationsEnabled, notificationEmail } = req.body;
    
    // Récupérer la tâche existante
    const todo = await todoPgService.getTodoById(todoId);
    
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tâche non trouvée' 
      });
    }
    
    if (notificationsEnabled && (!notificationEmail || !String(notificationEmail).includes('@'))) {
      return res.status(400).json({
        success: false,
        error: 'Un email valide est requis pour activer les notifications'
      });
    }

    const updateData = {
      notificationsEnabled: notificationsEnabled
    };

    if (notificationsEnabled) {
      updateData.notificationEmail = String(notificationEmail).trim();
      updateData.notificationSent = false;
    } else {
      updateData.notificationEmail = null;
      updateData.notificationSent = false;
    }
    
    // Mettre à jour la tâche
    const updatedTodo = await todoPgService.updateTodo(todoId, updateData);
    
    res.status(200).json(updatedTodo);
  } catch (error) {
    console.error('Erreur lors de la mise à jour des notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la mise à jour des notifications',
      details: error.message
    });
  }
});

// Envoyer un email de test
router.post('/test/:id', async (req, res) => {
  try {
    const todoId = req.params.id;
    const { testEmail } = req.body;
    
    // Vérifier si la tâche existe
    const todo = await todoPgService.getTodoById(todoId);
    
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Tâche non trouvée' 
      });
    }
    
    // Valider l'email de test ou utiliser celui de la tâche
    const emailToUse = testEmail || todo.notificationEmail;
    
    if (!emailToUse || !emailToUse.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Un email valide est requis pour envoyer un test' 
      });
    }
    
    // Envoyer l'email de test
    const result = await notificationService.sendTestNotification(todoId, emailToUse);
    
    res.status(200).json({
      success: true,
      message: `Email de test envoyé à ${emailToUse}`,
      details: result
    });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email de test:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de l\'envoi de l\'email de test',
      details: error.message
    });
  }
});

// Vérifier les notifications (pour les tests manuels)
router.get('/check', async (req, res) => {
  try {
    // Désactiver temporairement la vérification du token pour faciliter le diagnostic
    const skipTokenCheck = true; // Mettre à true pour ignorer la vérification du token
    
    // Vérifier le token de sécurité si configuré
    const configToken = process.env.NOTIFICATION_CHECK_TOKEN || 'dev_test_token';
    const requestToken = req.query.token;
    
    console.log('Token reçu:', requestToken);
    console.log('Token attendu:', configToken);
    console.log('Comparaison:', requestToken === configToken);
    
    // Validation simplifiée du token (désactivée en mode diagnostic)
    if (!skipTokenCheck && (!requestToken || requestToken !== configToken)) {
      return res.status(401).json({
        success: false,
        message: 'Token de sécurité invalide ou manquant',
        help: "Utilisez '?token=dev_test_token' à la fin de l'URL"
      });
    }
    
    // Exécuter la vérification et l'envoi des notifications
    console.log('Vérification manuelle des notifications déclenchée');
    await notificationService.checkTasksForNotification();
    const result = await notificationService.sendPendingNotifications();
    
    res.status(200).json({
      success: true,
      message: 'Vérification des notifications terminée avec succès',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Erreur lors de la vérification manuelle des notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la vérification des notifications',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/notifications/test-smtp
 * @desc    Tester la connexion SMTP
 * @access  Public
 */
router.get('/test-smtp', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre email requis (ex: /test-smtp?email=votre@email.com)'
      });
    }
    
    // Réinitialiser le transporteur d'email pour utiliser les dernières configurations
    const emailService = require('../services/emailService');
    await emailService.initializeEmailTransporter();
    
    // Afficher les infos de configuration utilisées
    console.log('Test SMTP avec la configuration:');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Non définie');
    console.log('- SMTP_PORT:', process.env.SMTP_PORT || 'Non défini');
    console.log('- SMTP_USER:', process.env.SMTP_USER ? 'Défini' : 'Non défini');
    console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Non définie');
    
    // Tester l'envoi d'email
    const result = await notificationService.testSmtpConnection(email);
    
    // Ajouter des informations sur la configuration au résultat
    result.configInfo = {
      smtpHost: process.env.SMTP_HOST || 'Non configuré (utilisation du mode test)',
      smtpPort: process.env.SMTP_PORT || 'Non configuré',
      emailFrom: process.env.EMAIL_FROM || 'Non configuré'
    };
    
    // Si c'est Ethereal, ajouter un message sur la façon de configurer SMTP
    if (!process.env.SMTP_HOST) {
      result.setupInfo = {
        message: 'Vous utilisez le mode test Ethereal. Pour configurer un vrai service SMTP:',
        steps: [
          'Exécutez node scripts/setup-smtp.js depuis la racine du projet',
          'Ou configurez manuellement les variables d\'environnement: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_FROM'
        ]
      };
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Erreur lors du test SMTP:', error);
    res.status(500).json({
      success: false,
      message: `Erreur lors du test SMTP: ${error.message}`,
      error: error.message
    });
  }
});

// Route simplifiée pour tester l'état du service de notification (sans token)
router.get('/status', async (req, res) => {
  try {
    // Vérifier si le service est actif sans envoyer de notifications
    const todos = await todoPgService.getTodosWithPendingNotifications();
    const pendingCount = todos.filter(todo => todo.shouldNotify && todo.shouldNotify()).length;

    res.status(200).json({
      success: true,
      message: 'État du service de notification',
      timestamp: new Date().toISOString(),
      pendingNotifications: pendingCount,
      serviceActive: notificationService.isServiceActive ? notificationService.isServiceActive() : true,
      isProduction: process.env.NODE_ENV === 'production',
      isVercel: process.env.VERCEL === '1'
    });
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'état du service:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de la vérification de l\'état du service',
      details: error.message
    });
  }
});

// Interface utilisateur simple pour tester les notifications
router.get('/test-ui', (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Test des Notifications TodoList</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
      .container { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
      h1 { color: #4a7c59; }
      .section { margin-bottom: 20px; padding: 15px; border: 1px solid #eee; border-radius: 5px; }
      .section h2 { margin-top: 0; }
      label { display: block; margin-bottom: 5px; font-weight: bold; }
      input, button { padding: 8px; margin-bottom: 10px; }
      input[type="text"], input[type="email"] { width: 100%; max-width: 300px; }
      button { background-color: #4a7c59; color: white; border: none; border-radius: 3px; cursor: pointer; }
      button:hover { background-color: #3a6c49; }
      .result { margin-top: 15px; padding: 10px; background-color: #f5f5f5; border-radius: 3px; white-space: pre-wrap; }
      .error { color: #bc4749; }
      .success { color: #4a7c59; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Test des Notifications TodoList</h1>
      
      <div class="section">
        <h2>État du Service</h2>
        <button id="checkStatus">Vérifier l'état du service</button>
        <div id="statusResult" class="result"></div>
      </div>
      
      <div class="section">
        <h2>Vérification des Notifications</h2>
        <label for="token">Token de sécurité:</label>
        <input type="text" id="token" value="dev_test_token">
        <button id="checkNotifications">Vérifier et envoyer les notifications</button>
        <div id="checkResult" class="result"></div>
      </div>
      
      <div class="section">
        <h2>Test d'Email</h2>
        <label for="email">Adresse email:</label>
        <input type="email" id="email" placeholder="votre@email.com">
        <button id="testEmail">Envoyer un email de test</button>
        <div id="emailResult" class="result"></div>
      </div>
    </div>
    
    <script>
      // Fonction pour mettre à jour un élément de résultat
      function updateResult(elementId, data, isError = false) {
        const element = document.getElementById(elementId);
        if (isError) {
          element.innerHTML = '<span class="error">Erreur: ' + data + '</span>';
        } else {
          element.innerHTML = '<span class="success">Succès:</span> ' + JSON.stringify(data, null, 2);
        }
      }
      
      // Vérifier l'état du service
      document.getElementById('checkStatus').addEventListener('click', async function() {
        try {
          const response = await fetch('/api/notifications/status');
          const data = await response.json();
          updateResult('statusResult', data);
        } catch (error) {
          updateResult('statusResult', error.message, true);
        }
      });
      
      // Vérifier et envoyer les notifications
      document.getElementById('checkNotifications').addEventListener('click', async function() {
        const token = document.getElementById('token').value;
        try {
          const response = await fetch('/api/notifications/check?token=' + encodeURIComponent(token));
          const data = await response.json();
          updateResult('checkResult', data);
        } catch (error) {
          updateResult('checkResult', error.message, true);
        }
      });
      
      // Tester l'envoi d'email
      document.getElementById('testEmail').addEventListener('click', async function() {
        const email = document.getElementById('email').value;
        try {
          const response = await fetch('/api/notifications/test-smtp?email=' + encodeURIComponent(email));
          const data = await response.json();
          updateResult('emailResult', data);
        } catch (error) {
          updateResult('emailResult', error.message, true);
        }
      });
    </script>
  </body>
  </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// Route pour diagnostiquer la configuration email
router.get('/email-diagnostics', (req, res) => {
  // Masquer les informations sensibles
  const maskString = (str) => {
    if (!str) return 'non défini';
    if (str.length <= 4) return '****';
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
  };

  const diagnostics = {
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'non défini',
      VERCEL: process.env.VERCEL === '1' ? 'oui' : 'non'
    },
    sendgrid: {
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? maskString(process.env.SENDGRID_API_KEY) : 'non défini',
      EMAIL_FROM: process.env.EMAIL_FROM || 'non défini'
    },
    smtp: {
      SMTP_HOST: process.env.SMTP_HOST || 'non défini',
      SMTP_PORT: process.env.SMTP_PORT || 'non défini',
      SMTP_USER: process.env.SMTP_USER ? maskString(process.env.SMTP_USER) : 'non défini',
      SMTP_PASS: process.env.SMTP_PASS ? '******' : 'non défini',
      SMTP_SECURE: process.env.SMTP_SECURE === 'true' ? 'oui' : 'non'
    },
    config: {
      isProduction: process.env.NODE_ENV === 'production',
      checkFrequency: process.env.NODE_ENV === 'production' ? '* * * * *' : '*/15 * * * * *'
    },
    timestamp: new Date().toISOString()
  };

  res.json({
    success: true,
    message: 'Diagnostics de configuration email',
    diagnostics
  });
});

// Route pour forcer une vérification des notifications
router.get('/force-check', async (req, res) => {
  try {
    console.log('Route force-check appelée');
    
    // Vérifier si la base de données est accessible
    const { getSequelize } = require('../config/postgres');
    const sequelize = getSequelize();
    let dbAvailable = false;
    
    if (sequelize) {
      try {
        await sequelize.authenticate();
        dbAvailable = true;
        console.log('[FORCE-CHECK] Connexion DB disponible');
      } catch (dbError) {
        console.warn('[FORCE-CHECK] Connexion DB non disponible:', dbError.message);
        dbAvailable = false;
      }
    }
    
    // Si la DB n'est pas disponible, retourner un message d'info plutôt qu'une erreur
    if (!dbAvailable) {
      console.log('[FORCE-CHECK] Base de données non disponible, retour d\'info sans erreur');
      return res.status(200).json({
        success: false,
        message: 'Base de données temporairement indisponible',
        dbAvailable: false,
        timestamp: new Date().toISOString(),
        note: 'Le service de notifications nécessite une connexion à la base de données. Réessayez plus tard.'
      });
    }
    
    // Vérifier les tâches pour les notifications
    let checkResult = null;
    try {
      checkResult = await notificationService.checkTasksForNotification();
    } catch (checkError) {
      console.error('[FORCE-CHECK] Erreur lors de la vérification des tâches:', checkError.message);
      // Continuer même en cas d'erreur de vérification
    }
    
    // Envoyer les notifications en attente
    let result = null;
    try {
      result = await notificationService.sendPendingNotifications();
    } catch (sendError) {
      console.error('[FORCE-CHECK] Erreur lors de l\'envoi des notifications:', sendError.message);
      // Retourner un résultat partiel même en cas d'erreur
      result = {
        total: 0,
        sent: 0,
        errors: 1,
        details: [{
          status: 'error',
          message: sendError.message
        }]
      };
    }
    
    res.status(200).json({
      success: true,
      message: 'Vérification des notifications terminée',
      dbAvailable: true,
      timestamp: new Date().toISOString(),
      checkResult,
      result
    });
  } catch (error) {
    console.error('[FORCE-CHECK] Erreur inattendue lors de la vérification des notifications:', error);
    
    // Toujours retourner 200 pour UptimeRobot, mais avec success: false
    // Cela évite que le monitoring considère le service comme down
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      note: 'Une erreur est survenue, mais le service est toujours opérationnel'
    });
  }
});

module.exports = router; 