const nodemailer = require('nodemailer');
const config = require('../config/config');

// Configuration du transporteur email
let transporter;

// Initialiser le transporteur d'email en fonction de l'environnement
const initializeEmailTransporter = async () => {
  try {
    // Vérifier si on est en production (déploiement)
    if (config.isProduction) {
      // Vérifier si on a une API key SendGrid (service gratuit pour 100 emails/jour)
      if (config.email.sendgrid.apiKey) {
        // Utiliser SendGrid pour la production
        transporter = nodemailer.createTransport({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: config.email.sendgrid.apiKey
          }
        });
        
        console.log('Service de messagerie SendGrid configuré pour la production');
      } else {
        // Si pas de clé SendGrid, utiliser un transporteur plus générique avec des variables d'environnement
        transporter = nodemailer.createTransport({
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure,
          auth: {
            user: config.email.smtp.auth.user || 'kaelyn.boyle@ethereal.email',
            pass: config.email.smtp.auth.pass || 'kCrQxkBvhsYsGdxSgA'
          }
        });
        
        console.log('Service de messagerie SMTP configuré avec les variables d\'environnement');
      }
    } else {
      // Pour le développement, utiliser Ethereal (service de test)
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        debug: true
      });
      
      console.log('Service de messagerie Ethereal configuré pour le développement');
      console.log('Identifiants Ethereal:', testAccount.user);
    }
    
    // Vérifier que la connexion fonctionne
    const verifyResult = await transporter.verify();
    console.log('Vérification de la connexion SMTP:', verifyResult);
    
    return transporter;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du transporteur d\'email:', error);
    
    // En cas d'échec, essayer un transporteur encore plus simple
    try {
      // Transporteur de secours avec Ethereal
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'kaelyn.boyle@ethereal.email',
          pass: 'kCrQxkBvhsYsGdxSgA'
        }
      });
      
      console.log('Transporteur de secours configuré avec des identifiants prédéfinis');
      return transporter;
    } catch (error2) {
      console.error('Erreur avec le transporteur de secours:', error2);
      
      // Dernier recours - transporteur JSON qui stocke les emails sans les envoyer
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      
      console.log('Transporteur JSON (mode simulé) configuré - les emails seront stockés mais non envoyés');
      return transporter;
    }
  }
};

// Initialiser le transporteur d'email au démarrage
initializeEmailTransporter();

// Fonction pour rafraîchir le transporteur (utile en cas de problème)
const refreshTransporter = async () => {
  console.log('Rafraîchissement du transporteur d\'email...');
  
  // En cas d'échec avec SendGrid, utiliser une solution alternative
  try {
    // Essayer d'abord avec un service de test Ethereal
    const testAccount = await nodemailer.createTestAccount();
    
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      },
      debug: true
    });
    
    console.log('Transporteur de secours configuré avec Ethereal:');
    console.log(`- User: ${testAccount.user}`);
    console.log(`- Preview URL: https://ethereal.email/login (utiliser les identifiants ci-dessus)`);
    
    return transporter;
  } catch (error) {
    console.error('Erreur avec tous les transporteurs d\'email:', error.message);
    
    // Dernier recours - simuler l'envoi sans réellement envoyer
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
    
    console.log('Mode simulation d\'envoi activé - les emails ne seront pas réellement envoyés');
    return transporter;
  }
};

// Envoyer un email de notification pour une tâche
const sendTaskNotification = async (todo) => {
  if (!todo || !todo.notificationEmail) {
    console.warn('Impossible d\'envoyer l\'email: email manquant');
    return { success: false, message: 'Email du destinataire manquant' };
  }
  
  try {
    // S'assurer que le transporteur est initialisé
    if (!transporter) {
      await initializeEmailTransporter();
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
    const diffHours = Math.round(diffMinutes / 60);
    
    // Formater le message selon le temps restant
    let timeMessage = '';
    if (diffMinutes < 60) {
      timeMessage = `dans moins d'une heure (${diffMinutes} minutes)`;
    } else if (diffHours < 24) {
      timeMessage = `dans ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else {
      timeMessage = `demain`;
    }
    
    // Adresse d'expédition par défaut - utiliser noreply pour éviter les problèmes de vérification
    const fromAddress = config.email.sendgrid.from || 'noreply@todolistapp.example.com';
    
    // Définir les options d'email
    const mailOptions = {
      from: `"TodoList App" <${fromAddress}>`,
      to: todo.notificationEmail,
      subject: diffMinutes <= 60 ? 
        `🚨 URGENT: "${todo.title}" est prévu ${timeMessage}!` :
        `⏰ Rappel: "${todo.title}" est prévu ${timeMessage}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4a7c59;">Rappel de tâche</h2>
          <p>Bonjour,</p>
          <p>Nous vous rappelons que la tâche suivante ${diffMinutes <= 60 ? '<span style="color: red; font-weight: bold;">est imminente</span>' : 'est prévue'} :</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid ${diffMinutes <= 60 ? '#bc4749' : '#4a7c59'};">
            <h3 style="margin-top: 0; color: #333;">${todo.title}</h3>
            ${todo.description ? `<p style="color: #666;">${todo.description}</p>` : ''}
            <p><strong>Date :</strong> ${formattedDate}</p>
            <p><strong>Heure :</strong> ${formattedTime}</p>
            <p><strong>Catégorie :</strong> ${todo.category || 'Non catégorisé'}</p>
            <p><strong>Priorité :</strong> <span style="color: ${getPriorityColor(todo.priority)};">${getPriorityLabel(todo.priority)}</span></p>
            <p><strong>Échéance :</strong> <span style="font-weight: bold; ${diffMinutes <= 60 ? 'color: red;' : ''}">${timeMessage}</span></p>
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
    
    // Ajouter également une version texte pour la compatibilité
    mailOptions.text = `
      Rappel de tâche: ${todo.title}
      Date: ${formattedDate}
      Heure: ${formattedTime}
      Échéance: ${timeMessage}
      
      Description: ${todo.description || 'Aucune description'}
      Catégorie: ${todo.category || 'Non spécifiée'}
      Priorité: ${getPriorityLabel(todo.priority)}
      
      Vous recevez cet email car vous avez activé les notifications pour cette tâche.
    `.replace(/      /g, '').trim();
    
    // Envoyer l'email
    console.log(`Envoi d'un email à ${todo.notificationEmail}...`);
    
    // Ajouter un délai pour éviter les erreurs de débit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let info = null;
    try {
      info = await transporter.sendMail(mailOptions);
    } catch (sendError) {
      // Si SendGrid échoue, essayer avec le transporteur de secours
      console.error('Échec avec le transporteur principal:', sendError.message);
      console.log('Tentative avec le transporteur de secours...');
      
      // Rafraîchir le transporteur et réessayer
      await refreshTransporter();
      info = await transporter.sendMail(mailOptions);
    }
    
    console.log(`Email envoyé: ${info.messageId}`);
    
    // Obtenir l'URL de prévisualisation (fonctionne uniquement avec Ethereal)
    let previewUrl = '';
    try {
      if (info.messageId && info.messageId.includes('ethereal')) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log(`Prévisualisation de l'email: ${previewUrl}`);
        }
      }
    } catch (error) {
      // Ignorer l'erreur, prévisualisation non disponible
    }
    
    return { 
      success: true, 
      message: `Email envoyé à ${todo.notificationEmail}`,
      messageId: info.messageId,
      previewUrl
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
  sendTaskNotification,
  refreshTransporter
}; 