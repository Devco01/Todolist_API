const nodemailer = require('nodemailer');

// Configuration du transporteur email
let transporter;

// Configurer un transporteur Gmail
const initializeGmailTransporter = () => {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'todolist.app.notif@gmail.com', // Adresse Gmail dédiée
        pass: 'ezvb kmbi axhb knud'          // Mot de passe d'application
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    console.log('Transporteur Gmail configuré avec succès');
    
    // Vérifier que la connexion fonctionne
    transporter.verify((error, success) => {
      if (error) {
        console.error('Erreur de vérification du transporteur SMTP:', error.message);
      } else {
        console.log('Connexion SMTP vérifiée avec succès');
      }
    });
    
    return transporter;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du transporteur Gmail:', error);
    
    // En cas d'échec, créer un transporteur de secours
    transporter = nodemailer.createTransport({
      jsonTransport: true // Ne fait rien, mais au moins l'application continue
    });
    
    console.log('Transporteur de secours configuré');
    return transporter;
  }
};

// Initialiser directement avec Gmail
initializeGmailTransporter();

// Envoyer un email de notification pour une tâche
const sendTaskNotification = async (todo) => {
  if (!todo || !todo.notificationEmail) {
    console.warn('Impossible d\'envoyer l\'email: email manquant');
    return { success: false, message: 'Email du destinataire manquant' };
  }
  
  try {
    // S'assurer que le transporteur est initialisé
    if (!transporter) {
      await initializeGmailTransporter();
    }
    
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
    
    // Déterminer si c'est un rappel urgent
    const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`);
    const now = new Date();
    const diffMinutes = Math.round((dueDate - now) / 60000);
    const isUrgent = diffMinutes <= 15;
    
    // Définir les options d'email
    const mailOptions = {
      from: '"TodoList App" <todolist.app.notif@gmail.com>',
      to: todo.notificationEmail,
      subject: isUrgent ? 
        `🚨 URGENT: "${todo.title}" est prévu dans moins de ${diffMinutes} minutes!` :
        `⏰ Rappel: "${todo.title}" est prévu dans 1 heure`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a7c59;">Rappel de tâche</h2>
          <p>Bonjour,</p>
          <p>Nous vous rappelons que la tâche suivante ${isUrgent ? '<span style="color: red; font-weight: bold;">est imminente</span>' : 'est prévue bientôt'} :</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid ${isUrgent ? '#bc4749' : '#4a7c59'};">
            <h3 style="margin-top: 0; color: #333;">${todo.title}</h3>
            ${todo.description ? `<p style="color: #666;">${todo.description}</p>` : ''}
            <p><strong>Date :</strong> ${formattedDate}</p>
            <p><strong>Heure :</strong> ${formattedTime}</p>
            <p><strong>Catégorie :</strong> ${todo.category || 'Non catégorisé'}</p>
            <p><strong>Priorité :</strong> <span style="color: ${getPriorityColor(todo.priority)};">${getPriorityLabel(todo.priority)}</span></p>
            ${isUrgent ? `<p style="color: red; font-weight: bold;">⚠️ Cette tâche est prévue dans ${diffMinutes} minutes!</p>` : ''}
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
    
    // Envoyer l'email
    console.log(`Envoi d'un email à ${todo.notificationEmail}...`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email envoyé: ${info.messageId}`);
    
    return { 
      success: true, 
      message: `Email envoyé à ${todo.notificationEmail}`,
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email:`, error.message);
    return { success: false, message: `Erreur d'envoi: ${error.message}` };
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
  sendTaskNotification
}; 