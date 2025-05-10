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
    const configToken = process.env.NOTIFICATION_CHECK_TOKEN;
    const requestToken = req.query.token;
    
    if (configToken && configToken.length > 0) {
      if (!requestToken || requestToken !== configToken) {
        return res.status(401).json({
          success: false,
          message: 'Token de sécurité invalide ou manquant'
        });
      }
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

module.exports = router; 