// Point d'entrée pour le cron Vercel qui vérifie les notifications avec PostgreSQL
const { connectPostgres, getSequelize } = require('../config/postgres');
const { getTodoModel } = require('../models/TodoPg');
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');

/**
 * Chemin du fichier de persistance des notifications envoyées
 */
const HISTORY_FILE_PATH = path.join(__dirname, '../data/notification_history.json');

/**
 * Stockage en mémoire des dernières notifications envoyées
 * Format: { todoId: timestamp }
 */
let notificationSentHistory = {};

/**
 * Chargement de l'historique des notifications depuis le fichier
 */
const loadNotificationHistory = () => {
  try {
    // Vérifier si le répertoire data existe, sinon le créer
    const dataDir = path.dirname(HISTORY_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      console.log('[CRON-PG] Création du répertoire de données pour l\'historique des notifications');
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Vérifier si le fichier existe
    if (fs.existsSync(HISTORY_FILE_PATH)) {
      const content = fs.readFileSync(HISTORY_FILE_PATH, 'utf8');
      console.log('[CRON-PG] Chargement de l\'historique des notifications:', 
        content ? `${content.length} caractères` : 'fichier vide');
      
      if (content && content.trim().length > 0) {
        notificationSentHistory = JSON.parse(content);
        console.log('[CRON-PG] Historique des notifications chargé, nombre d\'entrées:', 
          Object.keys(notificationSentHistory).length);
      }
    } else {
      console.log('[CRON-PG] Fichier d\'historique des notifications non trouvé, création d\'un fichier vide');
      saveNotificationHistory({}); // Créer un fichier vide
    }
  } catch (error) {
    console.error('[CRON-PG] Erreur lors du chargement de l\'historique des notifications:', error);
  }
};

/**
 * Sauvegarde l'historique des notifications dans le fichier
 */
const saveNotificationHistory = (history = notificationSentHistory) => {
  try {
    const content = JSON.stringify(history);
    fs.writeFileSync(HISTORY_FILE_PATH, content, 'utf8');
    console.log('[CRON-PG] Historique des notifications sauvegardé,', Object.keys(history).length, 'entrées');
  } catch (error) {
    console.error('[CRON-PG] Erreur lors de la sauvegarde de l\'historique des notifications:', error);
  }
};

// Charger l'historique des notifications au démarrage
loadNotificationHistory();

/**
 * Vérifie si une notification a déjà été envoyée récemment pour une tâche
 * @param {string|number} todoId - ID de la tâche
 * @param {number} cooldownHours - Période de refroidissement en heures
 * @returns {boolean} - True si une notification a été envoyée récemment
 */
const hasRecentNotification = (todoId, cooldownHours = 12) => {
  const lastTimestamp = notificationSentHistory[todoId];
  if (!lastTimestamp) {
    console.log(`[CRON-PG] Aucun historique de notification pour la tâche ${todoId}`);
    return false;
  }
  
  const now = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const elapsedHours = (now - lastTimestamp) / (1000 * 60 * 60);
  
  // Vérifier si la dernière notification est encore dans la période de cooldown
  const isInCooldown = (now - lastTimestamp) < cooldownMs;
  
  console.log(`[CRON-PG] Vérification du cooldown pour la tâche ${todoId}:
    - Dernière notification: ${new Date(lastTimestamp).toISOString()}
    - Temps écoulé: ${elapsedHours.toFixed(1)} heures
    - Période de cooldown: ${cooldownHours} heures
    - En période de cooldown: ${isInCooldown ? 'Oui' : 'Non'}
  `);
  
  return isInCooldown;
};

/**
 * Enregistre l'envoi d'une notification pour une tâche
 * @param {string|number} todoId - ID de la tâche
 */
const recordNotificationSent = (todoId) => {
  notificationSentHistory[todoId] = Date.now();
  // Sauvegarder l'historique après chaque envoi
  saveNotificationHistory();
  console.log(`[CRON-PG] Enregistrement de la notification pour la tâche ${todoId} à ${new Date().toISOString()}`);
};

/**
 * Route cron pour vérifier les notifications et les envoyer
 * Cette route est appelée par Vercel Cron
 */
module.exports = async (req, res) => {
  try {
    console.log('[CRON-PG] Vérification des notifications PostgreSQL déclenchée à', new Date().toISOString());
    
    // Vérifier l'heure courante - n'exécuter qu'à 8h
    const currentHour = new Date().getUTCHours();
    if (currentHour !== 8) {
      console.log(`[CRON-PG] Cron exécuté à ${currentHour}h UTC, mais nous n'envoyons des notifications qu'à 8h UTC`);
      return res.status(200).json({
        success: true,
        message: `Ignoré - heure actuelle (${currentHour}h UTC) différente de l'heure d'envoi (8h UTC)`,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`[CRON-PG] Cron exécuté à l'heure d'envoi (8h UTC), traitement des notifications...`);
    
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
    const todosToNotify = todos.filter(todo => {
      // Vérifier d'abord si la tâche justifie une notification selon ses propres critères
      const shouldSendByTodoRules = todo.shouldNotify();
      
      if (!shouldSendByTodoRules) {
        return false;
      }
      
      // Vérifier ensuite le cooldown pour éviter les notifications répétées
      const todoId = todo.id || todo._id;
      if (hasRecentNotification(todoId)) {
        console.log(`[CRON-PG] Cooldown actif pour la tâche ${todoId}, notification ignorée`);
        return false;
      }
      
      return true;
    });
    
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
        const todoId = todo.id || todo._id;
        
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
        
        // Enregistrer l'envoi dans notre système de cooldown
        recordNotificationSent(todoId);
        
        results.push({
          todoId: todoId,
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