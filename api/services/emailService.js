const nodemailer = require('nodemailer');

// Configuration du transporteur d'email
let transporter;

// Initialiser le transporteur d'email
const initTransporter = () => {
  // Vérifier si les variables d'environnement sont définies
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Les variables d\'environnement EMAIL_USER et EMAIL_PASS ne sont pas définies. Le service d\'email ne fonctionnera pas.');
    return false;
  }

  try {
    transporter = nodemailer.createTransport({
      service: 'gmail', // Vous pouvez changer ceci selon votre fournisseur d'email
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    console.log('Service d\'email initialisé avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service d\'email:', error);
    return false;
  }
};

// Envoyer un email de notification pour une tâche
const sendTaskNotification = async (todo) => {
  if (!transporter) {
    if (!initTransporter()) {
      console.warn('Impossible d\'envoyer l\'email: le transporteur n\'est pas initialisé');
      return false;
    }
  }

  try {
    // Formater la date et l'heure pour l'affichage
    const formattedDate = todo.dueDate;
    const formattedTime = todo.dueTime;
    
    // Construire le contenu de l'email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: todo.notificationEmail,
      subject: `Rappel: "${todo.title}" est prévu dans moins d'une heure`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #4CAF50;">Rappel de tâche</h2>
          <p>Bonjour,</p>
          <p>Nous vous rappelons que la tâche suivante est prévue dans moins d'une heure :</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">${todo.title}</h3>
            ${todo.description ? `<p style="color: #666;">${todo.description}</p>` : ''}
            <p><strong>Date :</strong> ${formattedDate}</p>
            <p><strong>Heure :</strong> ${formattedTime}</p>
            <p><strong>Catégorie :</strong> ${todo.category}</p>
            <p><strong>Priorité :</strong> ${todo.priority === 'high' ? 'Haute' : todo.priority === 'medium' ? 'Moyenne' : 'Basse'}</p>
          </div>
          <p>Vous recevez cet email car vous avez activé les notifications pour cette tâche.</p>
          <p>Cordialement,<br>Votre application TodoList</p>
        </div>
      `
    };

    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
};

module.exports = {
  initTransporter,
  sendTaskNotification
}; 