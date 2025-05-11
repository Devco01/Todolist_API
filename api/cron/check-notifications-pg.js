// Point d'entrée pour le cron Vercel qui vérifie les notifications avec PostgreSQL
const { connectPostgres, getSequelize } = require('../config/postgres');
const { getTodoModel } = require('../models/TodoPg');
const emailService = require('../services/emailService');

/**
 * Route cron pour vérifier les notifications et les envoyer
 * Cette route est appelée par Vercel Cron
 */
module.exports = async (req, res) => {
  try {
    console.log('[CRON-PG] Vérification des notifications PostgreSQL déclenchée');
    
    // Vérification du token de sécurité (si configuré)
    const configToken = process.env.NOTIFICATION_CHECK_TOKEN;
    const requestToken = req.query.token;
    
    // Si utilisé en dehors de Vercel Cron et qu'un token est configuré
    if (!process.env.VERCEL && configToken && configToken.length > 0) {
      if (!requestToken || requestToken !== configToken) {
        return res.status(401).json({
          success: false,
          message: 'Token de sécurité invalide ou manquant'
        });
      }
    }
    
    // Se connecter à PostgreSQL
    const sequelize = await connectPostgres();
    if (!sequelize) {
      return res.status(200).json({
        success: false,
        message: 'Échec de connexion à PostgreSQL',
        timestamp: new Date().toISOString()
      });
    }
    
    // Vérifier si la table Todo existe
    let tableExists = false;
    try {
      const [results] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'Todo'
        );
      `);
      tableExists = results[0]?.exists === true;
      console.log('[CRON-PG] La table Todo existe:', tableExists);
    } catch (error) {
      console.error('[CRON-PG] Erreur lors de la vérification de la table Todo:', error);
    }
    
    if (!tableExists) {
      return res.status(200).json({
        success: false,
        message: 'Table Todo non trouvée',
        timestamp: new Date().toISOString()
      });
    }
    
    // Obtenir le modèle Todo
    const TodoModel = getTodoModel();
    if (!TodoModel) {
      return res.status(200).json({
        success: false,
        message: 'Modèle Todo non disponible',
        timestamp: new Date().toISOString()
      });
    }
    
    // Récupérer les tâches avec notifications activées et non complétées
    const todos = await TodoModel.findAll({
      where: {
        notificationsEnabled: true,
        completed: false,
        dueDate: { [sequelize.Op.not]: null }
      }
    });
    
    console.log(`[CRON-PG] ${todos.length} tâches trouvées avec notifications activées`);
    
    // Filtrer les tâches pour lesquelles une notification doit être envoyée
    const todosToNotify = todos.filter(todo => todo.shouldNotify());
    
    console.log(`[CRON-PG] ${todosToNotify.length} tâches nécessitent une notification`);
    
    // Si aucune tâche à notifier
    if (todosToNotify.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucune notification à envoyer',
        timestamp: new Date().toISOString()
      });
    }
    
    // Envoyer les notifications
    const results = [];
    for (const todo of todosToNotify) {
      try {
        // Construire le contenu de l'email
        const emailData = {
          to: todo.notificationEmail,
          subject: `Rappel: "${todo.title}" - Tâche à effectuer aujourd'hui`,
          text: `
            Bonjour,
            
            Rappel pour votre tâche "${todo.title}" qui doit être effectuée aujourd'hui.
            
            Description: ${todo.description || 'Aucune description'}
            Catégorie: ${todo.category || 'Non spécifiée'}
            Priorité: ${todo.priority || 'Moyenne'}
            
            Cordialement,
            Votre application TodoList
          `.replace(/            /g, '').trim(),
          html: `
            <h2>Rappel : Tâche à effectuer aujourd'hui</h2>
            <h3>${todo.title}</h3>
            <p>Date d'échéance : <strong>${todo.dueDate}</strong> à <strong>${todo.dueTime || '00:00'}</strong></p>
            
            <h4>Détails :</h4>
            <p><strong>Description :</strong> ${todo.description || 'Aucune description'}</p>
            <p><strong>Catégorie :</strong> ${todo.category || 'Non spécifiée'}</p>
            <p><strong>Priorité :</strong> ${todo.priority || 'Moyenne'}</p>
            
            <hr>
            <p style="color: #666; font-size: 0.8em;">Cet email a été envoyé automatiquement par votre application TodoList</p>
          `.replace(/            /g, '').trim()
        };
        
        // Envoyer l'email
        const emailResult = await emailService.sendEmail(emailData);
        
        // Marquer la notification comme envoyée
        await todo.update({ notificationSent: true });
        
        results.push({
          todoId: todo.id,
          title: todo.title,
          success: true,
          email: todo.notificationEmail
        });
        
        console.log(`[CRON-PG] Notification envoyée pour "${todo.title}" à ${todo.notificationEmail}`);
      } catch (error) {
        console.error(`[CRON-PG] Erreur lors de l'envoi de la notification pour la tâche ${todo.id}:`, error);
        
        results.push({
          todoId: todo.id,
          title: todo.title,
          success: false,
          error: error.message
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `${results.filter(r => r.success).length}/${todosToNotify.length} notifications envoyées`,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[CRON-PG] Erreur lors de la vérification des notifications:', error);
    
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}; 