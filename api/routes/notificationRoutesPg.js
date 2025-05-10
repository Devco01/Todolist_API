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
    
    // Valider l'email si les notifications sont activées
    if (notificationsEnabled && (!notificationEmail || !notificationEmail.includes('@'))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Un email valide est requis pour activer les notifications' 
      });
    }
    
    // Préparer les données à mettre à jour
    const updateData = {
      notificationsEnabled: notificationsEnabled
    };
    
    if (notificationsEnabled) {
      updateData.notificationEmail = notificationEmail;
      updateData.notificationSent = false; // Réinitialiser le statut d'envoi
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
    // Vérifier le token de sécurité si configuré
    const configToken = process.env.NOTIFICATION_CHECK_TOKEN || 'dev_test_token';
    const requestToken = req.query.token;
    
    console.log('Token reçu:', requestToken);
    console.log('Token attendu:', configToken);
    console.log('Comparaison:', requestToken === configToken);
    
    // Validation simplifiée du token
    if (!requestToken || requestToken !== configToken) {
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

// Tester la connexion SMTP (sans nécessiter une tâche existante)
router.post('/test-smtp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Une adresse email valide est requise' 
      });
    }
    
    // Envoyer un email de test SMTP
    const result = await notificationService.testSmtpConnection(email);
    
    res.status(200).json({
      success: true,
      message: `Email de test envoyé à ${email}`,
      details: result
    });
  } catch (error) {
    console.error('Erreur lors du test SMTP:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erreur lors de l\'envoi de l\'email de test',
      details: error.message
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
          const response = await fetch('/api/notifications/test-smtp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
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

module.exports = router; 