const express = require('express');
const router = express.Router();
const Todo = require('../models/Todo');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

// Endpoint pour vérifier manuellement les notifications
// GET /api/notifications/force-check
router.get('/force-check', async (req, res) => {
  try {
    console.log('Vérification manuelle des notifications déclenchée');
    
    // Exécuter la vérification des tâches à notifier
    await notificationService.checkTasksForNotification();
    
    return res.status(200).json({
      success: true,
      message: 'Vérification des notifications lancée avec succès',
      stats: notificationService.getNotificationStats()
    });
  } catch (error) {
    console.error('Erreur lors de la vérification manuelle des notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des notifications',
      error: error.message
    });
  }
});

// Obtenir les statistiques de notification
// GET /api/notifications/stats
router.get('/stats', (req, res) => {
  try {
    const stats = notificationService.getNotificationStats();
    return res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// Activer/désactiver le mode debug
// POST /api/notifications/debug
router.post('/debug', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Le paramètre "enabled" doit être un booléen'
      });
    }
    
    const result = notificationService.setDebugMode(enabled);
    
    return res.status(200).json({
      success: true,
      message: `Mode debug ${enabled ? 'activé' : 'désactivé'}`,
      result
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du mode debug',
      error: error.message
    });
  }
});

// Rafraîchir la connexion email
// POST /api/notifications/refresh-email
router.post('/refresh-email', async (req, res) => {
  try {
    await emailService.refreshTransporter();
    
    return res.status(200).json({
      success: true,
      message: 'Connexion email rafraîchie avec succès'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement de la connexion email',
      error: error.message
    });
  }
});

// Réinitialiser le service de notification
// POST /api/notifications/reset
router.post('/reset', async (req, res) => {
  try {
    await notificationService.resetNotificationService();
    
    return res.status(200).json({
      success: true,
      message: 'Service de notification réinitialisé avec succès'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du service',
      error: error.message
    });
  }
});

// Mettre à jour les préférences de notification pour une tâche
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Validation de l'ID pour MongoDB
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'ID de tâche invalide' });
    }
    
    // Vérifier si MongoDB est connecté
    let isMongoConnected = false;
    try {
      isMongoConnected = Todo.db && Todo.db.readyState === 1;
    } catch (error) {
      return res.status(500).json({ error: 'Base de données non disponible' });
    }

    if (!isMongoConnected) {
      return res.status(500).json({ error: 'Base de données non disponible' });
    }
    
    // Extraire les données de notification de la requête
    const { notificationEmail, notificationsEnabled } = req.body;
    
    // Valider l'email si fourni
    if (notificationEmail && !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(notificationEmail)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    
    // Mettre à jour la tâche
    const updateData = {};
    
    if (notificationEmail !== undefined) {
      updateData.notificationEmail = notificationEmail;
    }
    
    if (notificationsEnabled !== undefined) {
      updateData.notificationsEnabled = notificationsEnabled;
      
      // Si les notifications sont activées, réinitialiser le statut d'envoi
      if (notificationsEnabled) {
        updateData.notificationSent = false;
      }
    }
    
    const todo = await Todo.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!todo) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    res.json({
      todo,
      message: notificationsEnabled ? 'Notifications configurées avec succès' : 'Notifications désactivées'
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    
    // Erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    res.status(500).json({ error: 'Erreur lors de la mise à jour des préférences de notification' });
  }
});

// Obtenir l'historique des notifications
// GET /api/notifications/history
router.get('/history', async (req, res) => {
  try {
    // Récupérer le paramètre limit de la requête (avec valeur par défaut de 50)
    const limit = parseInt(req.query.limit) || 50;
    
    // Limiter à 200 logs maximum
    const safeLimit = Math.min(limit, 200);
    
    const history = await notificationService.getNotificationHistory(safeLimit);
    
    return res.status(200).json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
});

module.exports = router; 