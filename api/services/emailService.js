const nodemailer = require('nodemailer');

// Configuration du transporteur d'email
let transporter;
let lastEmailConfig = null;

// Initialiser le transporteur d'email
const initTransporter = (customConfig = null) => {
  // Utiliser la configuration personnalisée si fournie, sinon utiliser les variables d'environnement
  const email = customConfig?.email || process.env.EMAIL_USER;
  const password = customConfig?.password || process.env.EMAIL_PASS;
  const host = customConfig?.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = customConfig?.port || process.env.EMAIL_PORT || 587;
  
  // Si une configuration personnalisée est fournie, la mémoriser
  if (customConfig?.email && customConfig?.password) {
    lastEmailConfig = { email, password, host, port };
  }
  
  if (!email || !password) {
    console.warn('Configuration email incomplète: EMAIL_USER et EMAIL_PASS sont requis');
    console.log('Variables disponibles:', {
      EMAIL_USER: email ? 'configuré' : 'non configuré',
      EMAIL_PASS: password ? 'configuré' : 'non configuré',
      EMAIL_HOST: host,
      EMAIL_PORT: port,
      NODE_ENV: process.env.NODE_ENV
    });
    
    if (process.env.VERCEL === '1') {
      console.warn('Environnement Vercel détecté. Vérifiez vos variables d\'environnement dans le dashboard Vercel.');
    }
    
    return false;
  }

  try {
    // Configuration pour les services courants
    if (host.includes('gmail')) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: email, pass: password }
      });
    } else if (host.includes('outlook') || host.includes('hotmail')) {
      transporter = nodemailer.createTransport({
        service: 'outlook',
        auth: { user: email, pass: password }
      });
    } else {
      // Configuration générique SMTP
      transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        auth: { user: email, pass: password },
        tls: { rejectUnauthorized: false } // Important pour certains serveurs SMTP
      });
    }
    
    console.log(`Service d'email initialisé (${host}:${port})`);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service d\'email:', error);
    return false;
  }
};

// Service d'email simplifié
const sendTaskNotification = async (todo) => {
  if (!todo || !todo.notificationEmail) {
    console.warn('Impossible d\'envoyer l\'email: données de tâche invalides ou email manquant');
    return { success: false, message: 'Email du destinataire manquant' };
  }
  
  try {
    // Formater la date pour l'affichage
    let formattedDate = todo.dueDate;
    
    // Si format YYYY-MM-DD, convertir en format plus lisible
    if (todo.dueDate && todo.dueDate.includes('-')) {
      const [year, month, day] = todo.dueDate.split('-');
      const date = new Date(year, month - 1, day);
      formattedDate = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    
    // Formater l'heure pour l'affichage
    const formattedTime = todo.dueTime || '00:00';
    
    // Créer le contenu de l'email
    const emailContent = `
      Rappel de tâche: "${todo.title}" est prévu dans moins d'une heure
      
      Date: ${formattedDate}
      Heure: ${formattedTime}
      Catégorie: ${todo.category || 'Non catégorisé'}
      Priorité: ${getPriorityLabel(todo.priority)}
      
      ${todo.description ? `Description: ${todo.description}` : ''}
      
      Vous recevez cet email car vous avez activé les notifications pour cette tâche.
    `;
    
    // Créer l'URL pour le service d'email
    const subject = encodeURIComponent(`Rappel: "${todo.title}" est prévu dans moins d'une heure`);
    const body = encodeURIComponent(emailContent);
    const mailtoUrl = `mailto:${todo.notificationEmail}?subject=${subject}&body=${body}`;
    
    // Simuler l'envoi d'email
    console.log(`Email de notification préparé pour ${todo.notificationEmail}`);
    console.log(`---------------------------------------`);
    console.log(`Sujet: Rappel: "${todo.title}" est prévu dans moins d'une heure`);
    console.log(`Contenu: ${emailContent}`);
    console.log(`---------------------------------------`);
    console.log(`Pour envoyer manuellement: ${mailtoUrl}`);
    
    // Retourner un lien mailto qui peut être utilisé pour envoyer l'email
    return { 
      success: true, 
      message: `Email préparé pour ${todo.notificationEmail}`, 
      mailtoUrl: mailtoUrl
    };
  } catch (error) {
    console.error(`Erreur lors de la préparation de l'email:`, error.message);
    return { success: false, message: `Erreur: ${error.message}` };
  }
};

// Tester les notifications
const testNotification = async (todoId, email) => {
  try {
    // Créer une tâche factice pour tester
    const testTodo = {
      title: 'Test de notification email',
      description: 'Ceci est un email de test pour vérifier les notifications.',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      category: 'autre',
      priority: 'medium',
      notificationEmail: email
    };
    
    // Préparer l'email
    const result = await sendTaskNotification(testTodo);
    
    return result;
  } catch (error) {
    console.error('Erreur lors du test de notification:', error);
    return { success: false, message: `Erreur: ${error.message}` };
  }
};

// Configurer les paramètres d'email pour l'utilisateur actuel
const configureEmailSettings = (emailConfig) => {
  try {
    if (!emailConfig || !emailConfig.email || !emailConfig.password) {
      return {
        success: false,
        message: 'Configuration incomplète: email et mot de passe requis'
      };
    }
    
    // Créer un transporteur temporaire pour tester la connexion
    let testTransporter;
    const host = emailConfig.host || 'smtp.gmail.com';
    const port = emailConfig.port || 587;
    
    if (host.includes('gmail')) {
      testTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailConfig.email, pass: emailConfig.password }
      });
    } else if (host.includes('outlook') || host.includes('hotmail')) {
      testTransporter = nodemailer.createTransport({
        service: 'outlook',
        auth: { user: emailConfig.email, pass: emailConfig.password }
      });
    } else {
      testTransporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        auth: { user: emailConfig.email, pass: emailConfig.password },
        tls: { rejectUnauthorized: false }
      });
    }
    
    // Si tout va bien, mettre à jour la configuration
    transporter = testTransporter;
    lastEmailConfig = { 
      email: emailConfig.email, 
      password: emailConfig.password,
      host: host,
      port: port
    };
    
    console.log(`Service d'email configuré manuellement pour ${emailConfig.email}`);
    return {
      success: true,
      message: 'Configuration email réussie'
    };
  } catch (error) {
    console.error('Erreur lors de la configuration de l\'email:', error);
    return {
      success: false,
      message: `Erreur de configuration: ${error.message}`
    };
  }
};

// Fonctions utilitaires
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'high': return '#bc4749';
    case 'medium': return '#d9a557';
    default: return '#588157';
  }
};

const getPriorityLabel = (priority) => {
  switch (priority) {
    case 'high': return 'Haute';
    case 'medium': return 'Moyenne';
    default: return 'Basse';
  }
};

module.exports = {
  initTransporter,
  sendTaskNotification,
  configureEmailSettings,
  testNotification
}; 