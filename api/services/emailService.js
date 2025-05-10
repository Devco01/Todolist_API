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

// Envoyer un email de notification pour une tâche
const sendTaskNotification = async (todo) => {
  if (!todo || !todo.notificationEmail) {
    console.warn('Impossible d\'envoyer l\'email: données de tâche invalides ou email manquant');
    return false;
  }
  
  // Vérifier que le transporteur est initialisé avec les variables d'environnement
  if (!transporter) {
    const success = initTransporter();
    
    // Si l'initialisation a échoué et qu'il n'y a pas de configuration précédente mémorisée
    if (!success && !lastEmailConfig) {
      // Informer l'utilisateur que les notifications par email nécessitent une configuration
      console.log(`Email de notification vers ${todo.notificationEmail} impossible: configuration email manquante`);
      return { 
        success: false, 
        message: 'Configuration email manquante. Veuillez configurer les variables d\'environnement EMAIL_USER et EMAIL_PASS ou utiliser l\'API de configuration d\'email.' 
      };
    }
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
    
    // Déterminer l'expéditeur de l'email
    const senderEmail = process.env.EMAIL_USER || lastEmailConfig?.email;
    
    // Construire le contenu de l'email avec plus d'informations
    const mailOptions = {
      from: senderEmail ? `"TodoList App" <${senderEmail}>` : `"TodoList App" <noreply@todolist.app>`,
      to: todo.notificationEmail,
      subject: `Rappel: "${todo.title}" est prévu dans moins d'une heure`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a7c59;">Rappel de tâche</h2>
          <p>Bonjour,</p>
          <p>Nous vous rappelons que la tâche suivante est prévue dans moins d'une heure :</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4a7c59;">
            <h3 style="margin-top: 0; color: #333;">${todo.title}</h3>
            ${todo.description ? `<p style="color: #666;">${todo.description}</p>` : ''}
            <p><strong>Date :</strong> ${formattedDate}</p>
            <p><strong>Heure :</strong> ${formattedTime}</p>
            <p><strong>Catégorie :</strong> ${todo.category || 'Non catégorisé'}</p>
            <p><strong>Priorité :</strong> <span style="color: ${getPriorityColor(todo.priority)};">${getPriorityLabel(todo.priority)}</span></p>
          </div>
          <p>Vous recevez cet email car vous avez activé les notifications pour cette tâche.</p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="font-size: 0.9rem; color: #666;">
            Cordialement,<br>
            Votre application TodoList<br>
            <em>Ne répondez pas à cet email, il a été envoyé automatiquement.</em>
          </p>
        </div>
      `
    };

    // Ajouter des logs détaillés
    console.log(`Tentative d'envoi d'email pour "${todo.title}" à ${todo.notificationEmail}`);
    
    // Envoyer l'email avec gestion du délai
    const info = await Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Délai d\'envoi d\'email dépassé')), 30000)
      )
    ]);
    
    console.log(`Email envoyé avec succès: ${info.messageId}`);
    return { success: true, message: 'Email envoyé avec succès' };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email pour "${todo.title}":`, error.message);
    
    // Tentative de réinitialisation du transporteur en cas d'erreur d'authentification
    if (error.message.includes('auth') || error.message.includes('credentials')) {
      console.log('Tentative de réinitialisation du transporteur email...');
      transporter = null;
      
      // Réinitialiser avec la dernière configuration qui a fonctionné
      if (lastEmailConfig) {
        initTransporter(lastEmailConfig);
      } else {
        initTransporter();
      }
    }
    
    return { success: false, message: `Erreur d'envoi: ${error.message}` };
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

// Ajouter ces fonctions utilitaires au début du fichier
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
  configureEmailSettings
}; 