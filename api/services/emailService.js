const nodemailer = require('nodemailer');
const config = require('../config/config');

// Configuration du transporteur email
let transporter;

// Initialiser le transporteur d'email en fonction de l'environnement
const initializeEmailTransporter = async () => {
  try {
    // Vérifier si les variables d'environnement SMTP sont configurées
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log('Configuration du transporteur SMTP avec les variables d\'environnement...');
      
      // Créer un transporteur SMTP réel
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        debug: process.env.NODE_ENV !== 'production',
        logger: process.env.NODE_ENV !== 'production'
      });
      
      console.log('Transporteur SMTP configuré avec succès:');
      console.log(`- Host: ${process.env.SMTP_HOST}`);
      console.log(`- Port: ${process.env.SMTP_PORT || 587}`);
      console.log(`- User: ${process.env.SMTP_USER}`);
      
      // Vérifier la connexion SMTP
      try {
        await transporter.verify();
        console.log('Connexion SMTP vérifiée avec succès');
      } catch (verifyError) {
        console.error('Erreur lors de la vérification SMTP:', verifyError.message);
        throw new Error(`Échec de la vérification SMTP: ${verifyError.message}`);
      }
      
      return transporter;
    } else {
      console.log('Variables SMTP non configurées, utilisation d\'Ethereal comme solution de repli...');
      
      // Créer un compte de test Ethereal
      const testAccount = await nodemailer.createTestAccount();
      
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        },
        debug: true,
        logger: true // Activer le logger pour plus de détails
      });
      
      console.log('==========================================');
      console.log('INFORMATIONS DU COMPTE ETHEREAL (MODE TEST):');
      console.log('------------------------------------------');
      console.log(`EMAIL: ${testAccount.user}`);
      console.log(`MOT DE PASSE: ${testAccount.pass}`);
      console.log(`HOST: ${testAccount.smtp.host}`);
      console.log(`PORT: ${testAccount.smtp.port}`);
      console.log('------------------------------------------');
      console.log('POUR VOIR LES EMAILS:');
      console.log('1. Allez sur https://ethereal.email/login');
      console.log(`2. Connectez-vous avec: ${testAccount.user}`);
      console.log(`3. Et le mot de passe: ${testAccount.pass}`);
      console.log('------------------------------------------');
      console.log('POUR CONFIGURER UN VRAI SERVICE SMTP:');
      console.log('1. Ajoutez les variables d\'environnement suivantes:');
      console.log('   - SMTP_HOST (ex: smtp.gmail.com)');
      console.log('   - SMTP_PORT (ex: 587)');
      console.log('   - SMTP_USER (votre adresse email)');
      console.log('   - SMTP_PASS (votre mot de passe ou mot de passe d\'application)');
      console.log('   - SMTP_SECURE (true ou false)');
      console.log('   - EMAIL_FROM (adresse d\'expéditeur)');
      console.log('==========================================');
      
      return transporter;
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du transporteur email:', error);
    
    // Mode de secours - simuler l'envoi
    transporter = nodemailer.createTransport({
      jsonTransport: true
    });
    
    console.log('Mode simulation d\'envoi activé - les emails ne seront pas envoyés');
    return transporter;
  }
};

// Initialiser le transporteur d'email au démarrage
initializeEmailTransporter();

// Fonction pour rafraîchir le transporteur (utile en cas de problème)
const refreshTransporter = async () => {
  console.log('Rafraîchissement du transporteur d\'email...');
  
  try {
    // Essayer d'abord avec la configuration SMTP principale
    return await initializeEmailTransporter();
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du transporteur:', error.message);
    
    // Dernier recours - transporteur JSON qui stocke les emails sans les envoyer
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
    
    // Afficher la configuration actuelle pour le débug
    console.log('Configuration email actuelle:');
    console.log('- SMTP_HOST:', process.env.SMTP_HOST || 'Non définie');
    console.log('- SMTP_USER:', process.env.SMTP_USER ? 'Défini' : 'Non défini');
    console.log('- EMAIL_FROM:', process.env.EMAIL_FROM || 'Non définie');
    console.log('- Transporteur actif:', transporter ? (transporter.options ? transporter.options.host || 'jsonTransport' : 'inconnu') : 'aucun');
    
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
    
    // Adresse d'expédition par défaut - utiliser EMAIL_FROM s'il est défini
    const fromAddress = process.env.EMAIL_FROM || 'noreply@todolist.example.com';
    
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
      console.log('Tentative d\'envoi avec le transporteur principal...');
      info = await transporter.sendMail(mailOptions);
      console.log('Résultat de l\'envoi:', JSON.stringify(info, null, 2));
    } catch (sendError) {
      console.error('Échec avec le transporteur principal:', sendError.message);
      console.log('Tentative avec le transporteur de secours...');
      
      // Rafraîchir le transporteur et réessayer
      await refreshTransporter();
      info = await transporter.sendMail(mailOptions);
      console.log('Résultat de l\'envoi avec transporteur de secours:', JSON.stringify(info, null, 2));
    }
    
    console.log(`Email envoyé: ${info.messageId || 'Pas d\'ID de message'}`);
    
    // Obtenir l'URL de prévisualisation (fonctionne uniquement avec Ethereal)
    let previewUrl = '';
    try {
      if (info.messageId && info.messageId.includes('ethereal')) {
        previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`Prévisualisation de l'email: ${previewUrl || 'Non disponible'}`);
      } else {
        console.log('Prévisualisation non disponible pour ce transporteur');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'URL de prévisualisation:', error.message);
    }
    
    return { 
      success: true, 
      message: `Email envoyé à ${todo.notificationEmail}`,
      messageId: info.messageId || '',
      previewUrl: previewUrl || '',
      details: info.response || ''
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

// Exposer une fonction pour envoyer un email générique
const sendEmail = async (emailData) => {
  if (!emailData || !emailData.to) {
    return { success: false, message: 'Données d\'email incomplètes' };
  }
  
  try {
    // S'assurer que le transporteur est initialisé
    if (!transporter) {
      await initializeEmailTransporter();
    }
    
    // Adresse d'expédition
    const fromAddress = process.env.EMAIL_FROM || 'noreply@todolist.example.com';
    
    // Compléter les options manquantes
    const mailOptions = {
      from: emailData.from || `"TodoList App" <${fromAddress}>`,
      to: emailData.to,
      subject: emailData.subject || 'Message de TodoList App',
      text: emailData.text || 'Ce message n\'a pas de contenu texte.',
      html: emailData.html || '<p>Ce message n\'a pas de contenu HTML.</p>'
    };
    
    // Envoyer l'email
    console.log(`Envoi d'un email à ${emailData.to}...`);
    const info = await transporter.sendMail(mailOptions);
    
    // Obtenir l'URL de prévisualisation (fonctionne uniquement avec Ethereal)
    let previewUrl = '';
    if (info.messageId && info.messageId.includes('ethereal')) {
      previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`Prévisualisation de l'email: ${previewUrl}`);
    }
    
    return { 
      success: true, 
      message: `Email envoyé à ${emailData.to}`,
      messageId: info.messageId || '',
      previewUrl: previewUrl || '',
      details: info.response || ''
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email:`, error);
    
    // Tenter avec le transporteur de secours
    try {
      console.log('Tentative avec le transporteur de secours...');
      await refreshTransporter();
      
      // Adresse d'expédition
      const fromAddress = process.env.EMAIL_FROM || 'noreply@todolist.example.com';
      
      // Compléter les options manquantes
      const mailOptions = {
        from: emailData.from || `"TodoList App" <${fromAddress}>`,
        to: emailData.to,
        subject: emailData.subject || 'Message de TodoList App',
        text: emailData.text || 'Ce message n\'a pas de contenu texte.',
        html: emailData.html || '<p>Ce message n\'a pas de contenu HTML.</p>'
      };
      
      const info = await transporter.sendMail(mailOptions);
      
      // Obtenir l'URL de prévisualisation (fonctionne uniquement avec Ethereal)
      let previewUrl = '';
      if (info.messageId && info.messageId.includes('ethereal')) {
        previewUrl = nodemailer.getTestMessageUrl(info);
      }
      
      return { 
        success: true, 
        message: `Email envoyé à ${emailData.to} (transporteur de secours)`,
        messageId: info.messageId || '',
        previewUrl: previewUrl || '',
        details: info.response || ''
      };
    } catch (secondError) {
      console.error(`Échec de l'envoi avec le transporteur de secours:`, secondError);
      return { success: false, message: `Erreur d'envoi: ${error.message}` };
    }
  }
};

module.exports = {
  sendTaskNotification,
  refreshTransporter,
  sendEmail,
  initializeEmailTransporter
}; 