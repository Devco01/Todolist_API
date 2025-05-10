const nodemailer = require('nodemailer');

// Créer un transporteur SMTP pour les tests avec Mailtrap
let transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "fbfa40d56cdaad",
    pass: "4d87b3cc7f3aa1"
  }
});

// Envoyer un email de notification pour une tâche
const sendTaskNotification = async (todo) => {
  if (!todo || !todo.notificationEmail) {
    console.warn('Impossible d\'envoyer l\'email: email manquant');
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
    
    // Définir les options d'email
    const mailOptions = {
      from: '"TodoList App" <notification@todolist.app>',
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
    
    // Envoyer l'email
    console.log(`Envoi d'un email à ${todo.notificationEmail}...`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email envoyé: ${info.messageId}`);
    console.log(`Prévisualisation: ${nodemailer.getTestMessageUrl(info)}`);
    
    return { 
      success: true, 
      message: `Email envoyé à ${todo.notificationEmail}`,
      previewUrl: nodemailer.getTestMessageUrl(info)
    };
  } catch (error) {
    console.error(`Erreur lors de l'envoi de l'email:`, error.message);
    return { success: false, message: `Erreur d'envoi: ${error.message}` };
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
    
    // Envoyer l'email de test
    const result = await sendTaskNotification(testTodo);
    
    return result;
  } catch (error) {
    console.error('Erreur lors du test de notification:', error);
    return { success: false, message: `Erreur: ${error.message}` };
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
  testNotification
}; 