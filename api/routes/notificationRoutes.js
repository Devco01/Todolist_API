const router = require('express').Router();
const Todo = require('../models/Todo');
const notificationService = require('../services/notificationService');

// Obtenir les statistiques de notification
router.get('/stats', (req, res) => {
  try {
    const stats = notificationService.getNotificationStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques de notification' });
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

// Envoyer une notification de test
router.post('/test/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Validation de l'ID pour MongoDB
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'ID de tâche invalide' });
    }
    
    // Extraire l'email de test de la requête
    const { testEmail } = req.body;
    
    // Envoyer la notification de test
    const result = await notificationService.testNotification(id, testEmail);
    
    if (result.success) {
      res.json({ message: result.message });
    } else {
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la notification de test' });
  }
});

module.exports = router; 