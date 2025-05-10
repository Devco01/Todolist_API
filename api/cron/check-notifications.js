// Point d'entrée pour le cron Vercel qui vérifie les notifications
const { connectDB } = require('../config/db');
const notificationService = require('../services/notificationService');

// Cette fonction sera appelée par Vercel Cron toutes les 5 minutes
module.exports = async (req, res) => {
  console.log('Cron Vercel: Vérification des notifications déclenchée');
  
  try {
    // Établir la connexion à MongoDB
    await connectDB();
    
    // Vérifier les tâches pour les notifications
    await notificationService.checkTasksForNotification();
    
    // Envoyer les notifications en attente
    const result = await notificationService.sendPendingNotifications();
    
    // Retourner une réponse de succès
    res.status(200).json({
      success: true,
      message: 'Vérification des notifications terminée avec succès',
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Erreur lors de la vérification des notifications via cron:', error);
    
    // Même en cas d'erreur, retourner 200 pour que Vercel ne considère pas le cron comme échoué
    res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 