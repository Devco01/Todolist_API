// Point d'entrée pour le cron Vercel qui vérifie les notifications avec PostgreSQL
const { connectPostgres, getSequelize } = require('../config/postgres');
const { getTodoModel } = require('../models/TodoPg');
const emailService = require('../services/emailService');
const fs = require('fs');
const path = require('path');

// LOGS DE DÉBOGAGE POUR VERCEL CRON
console.log('=============================================');
console.log('EXÉCUTION DU CRON DE NOTIFICATIONS À', new Date().toISOString());
console.log('Timezone du serveur:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Heure locale du serveur:', new Date().toLocaleTimeString());
console.log('=============================================');

// Vérifier les variables d'environnement critiques
console.log('VARIABLES D\'ENVIRONNEMENT:');
console.log('- SMTP_HOST:', process.env.SMTP_HOST ? 'Défini' : 'Non défini');
console.log('- SMTP_USER:', process.env.SMTP_USER ? 'Défini' : 'Non défini');
console.log('- SMTP_PASS:', process.env.SMTP_PASS ? 'Défini (longueur: ' + process.env.SMTP_PASS.length + ')' : 'Non défini');
console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Non défini');
console.log('- POSTGRES_URL:', process.env.POSTGRES_URL ? 'Défini' : 'Non défini');
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? 'Défini' : 'Non défini');
console.log('=============================================');

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

/** Rétention en millisecondes (90 jours) pour limiter la croissance mémoire/stockage */
const HISTORY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Purge les entrées de l'historique plus vieilles que HISTORY_RETENTION_MS.
 * Évite que l'historique (fichier + mémoire) ne grossisse indéfiniment.
 */
const purgeOldNotificationHistory = () => {
  const now = Date.now();
  const before = Object.keys(notificationSentHistory).length;
  const filtered = {};
  for (const [todoId, timestamp] of Object.entries(notificationSentHistory)) {
    if (now - timestamp < HISTORY_RETENTION_MS) {
      filtered[todoId] = timestamp;
    }
  }
  const removed = before - Object.keys(filtered).length;
  if (removed > 0) {
    notificationSentHistory = filtered;
    saveNotificationHistory();
    console.log('[CRON-PG] Purge de l\'historique:', removed, 'entrées supprimées (> 90 jours), reste', Object.keys(filtered).length);
  }
};

// Charger l'historique des notifications au démarrage
loadNotificationHistory();
// Purger les entrées trop vieilles pour limiter l'utilisation mémoire/stockage
purgeOldNotificationHistory();

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
 * Vérifie si une date est aujourd'hui
 * @param {string} dateStr - Date au format YYYY-MM-DD
 * @returns {boolean} - True si la date est aujourd'hui
 */
const isToday = (dateStr) => {
  if (!dateStr) return false;
  
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  return dateStr === todayStr;
};

/**
 * Route cron pour vérifier les notifications et les envoyer
 * Cette route est appelée par Vercel Cron
 */
/** Date du jour YYYY-MM-DD dans la timezone (ex: Europe/Paris) pour comparer avec dueDate */
const getTodayInTZ = (timeZone = 'UTC') => {
  return new Date().toLocaleDateString('en-CA', { timeZone });
};

module.exports = async (req, res) => {
  try {
    console.log('[CRON-PG] Vérification des notifications PostgreSQL déclenchée à', new Date().toISOString());

    // En production, refuser si SMTP non configuré (les mails ne partiraient pas)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    if (isProduction && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      console.warn('[CRON-PG] SMTP non configuré en production - aucune notification envoyée');
      return res.status(503).json({
        success: false,
        message: 'SMTP non configuré. Définir SMTP_HOST, SMTP_USER, SMTP_PASS (et optionnellement EMAIL_FROM) dans les variables d\'environnement Vercel.',
        timestamp: new Date().toISOString()
      });
    }

    // Ne traiter qu'à l'heure prévue (cron Vercel = 7h UTC = 8h Paris)
    const hourUTC = new Date().getUTCHours();
    const targetHourUTC = parseInt(process.env.NOTIFICATION_CRON_HOUR_UTC || '7', 10);
    if (hourUTC !== targetHourUTC) {
      console.log(`[CRON-PG] Heure actuelle ${hourUTC}h UTC, envoi prévu à ${targetHourUTC}h UTC (8h Paris), ignoré`);
      return res.status(200).json({
        success: true,
        message: `Envoi des rappels à ${targetHourUTC}h UTC (ex: 8h Paris)`,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[CRON-PG] Heure d'envoi (${targetHourUTC}h UTC), traitement des notifications...`);
    
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
    
    // CRITIQUE: Réutiliser la connexion existante pour éviter les reconnexions
    // Le cron s'exécute tous les jours, pas besoin de recréer la connexion à chaque fois
    let sequelize = getSequelize();
    if (!sequelize) {
      // Seulement si pas de connexion existante, en créer une
      const connected = await connectPostgres();
      if (!connected) {
        return res.status(200).json({
          success: false,
          message: 'Échec de connexion à PostgreSQL',
          timestamp: new Date().toISOString()
        });
      }
      sequelize = getSequelize();
    } else {
      console.log('[CRON-PG] Réutilisation de la connexion PostgreSQL existante');
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
    
    // Timezone pour "aujourd'hui" (ex: Europe/Paris)
    const cronTz = process.env.CRON_TZ || 'Europe/Paris';
    const todayStr = getTodayInTZ(cronTz);
    console.log(`[CRON-PG] Date du jour (${cronTz}): ${todayStr}`);

    // Récupérer les tâches : notifications activées, non complétées, pas encore notifiées, avec email, échéance aujourd'hui
    const todos = await TodoModel.findAll({
      where: {
        notificationsEnabled: true,
        completed: false,
        dueDate: todayStr,
        notificationSent: { [sequelize.Op.or]: [false, null] },
        notificationEmail: { [sequelize.Op.and]: [{ [sequelize.Op.ne]: null }, { [sequelize.Op.ne]: '' }] }
      }
    });

    console.log(`[CRON-PG] ${todos.length} tâche(s) à notifier pour le ${todayStr}`);

    const todosForToday = todos;

    if (todosForToday.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucune tâche pour aujourd\'hui, pas de notification à envoyer',
        timestamp: new Date().toISOString()
      });
    }
    
    // Filtrer les tâches pour lesquelles une notification doit être envoyée
    const todosToNotify = todosForToday.filter(todo => {
      // Vérifier le cooldown pour éviter les notifications répétées
      const todoId = todo.id || todo._id;
      if (hasRecentNotification(todoId)) {
        console.log(`[CRON-PG] Cooldown actif pour la tâche ${todoId}, notification ignorée`);
        return false;
      }
      
      return true;
    });
    
    console.log(`[CRON-PG] ${todosToNotify.length} tâches d'aujourd'hui nécessitent une notification`);
    
    // Si aucune tâche à notifier
    if (todosToNotify.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Aucune notification à envoyer pour les tâches d\'aujourd\'hui',
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
          subject: `Rappel: "${todo.title}" - Tâche à effectuer AUJOURD'HUI`,
          text: `
            Bonjour,
            
            Rappel pour votre tâche "${todo.title}" qui doit être effectuée AUJOURD'HUI.
            
            Description: ${todo.description || 'Aucune description'}
            Catégorie: ${todo.category || 'Non spécifiée'}
            Priorité: ${todo.priority || 'Moyenne'}
            Heure: ${todo.dueTime || 'Non spécifiée'}
            
            Cordialement,
            Votre application TodoList
          `.replace(/            /g, '').trim(),
          html: `
            <h2>Rappel : Tâche à effectuer AUJOURD'HUI</h2>
            <h3>${todo.title}</h3>
            <p>Date d'échéance : <strong>AUJOURD'HUI</strong> à <strong>${todo.dueTime || '00:00'}</strong></p>
            
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
        const sent = emailResult && emailResult.success;

        if (sent) {
          await todo.update({ notificationSent: true });
          recordNotificationSent(todoId);
          console.log(`[CRON-PG] Notification envoyée pour "${todo.title}" à ${todo.notificationEmail}`);
        }

        results.push({
          todoId: todoId,
          title: todo.title,
          success: sent,
          email: todo.notificationEmail,
          ...(sent ? {} : { error: (emailResult && emailResult.message) || 'Envoi échoué' })
        });
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
      message: `${results.filter(r => r.success).length}/${todosToNotify.length} notifications envoyées pour les tâches d'aujourd'hui`,
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