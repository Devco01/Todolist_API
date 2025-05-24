const router = require('express').Router();
const todoPgService = require('../services/todoPgService');
const { protect } = require('../middleware/authMiddleware');

// Initialiser le service au démarrage
(async () => {
  try {
    await todoPgService.init();
    console.log('Routes todos avec PostgreSQL initialisées');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des routes Postgres:', error);
  }
})();

// Récupérer toutes les tâches (protégé par authentification)
router.get('/', protect, async (req, res) => {
  try {
    // Utiliser l'ID de l'utilisateur connecté pour récupérer ses tâches
    const todos = await todoPgService.getAllTodosByUser(req.user.id);
    res.json(todos);
  } catch (error) {
    console.error('Erreur lors de la récupération des todos:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des tâches',
      details: error.message
    });
  }
});

// Créer une nouvelle tâche (protégé par authentification)
router.post('/', protect, async (req, res) => {
  try {
    // Log des données reçues
    console.log('POST /todos - Données reçues:', JSON.stringify(req.body));
    
    // Validation de base
    if (!req.body.title || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    
    // Normaliser le format de date si nécessaire
    const todoData = { ...req.body };
    
    // Vérifier que l'utilisateur a un ID valide
    if (!req.user || !req.user.id) {
      console.error('POST /todos - Erreur: ID utilisateur non disponible dans req.user');
      return res.status(401).json({ 
        error: 'Erreur d\'authentification, veuillez vous reconnecter',
        details: 'ID utilisateur manquant'
      });
    }
    
    // Vérifier explicitement que l'utilisateur existe dans la base de données
    const { getUserModel } = require('../models/UserPg');
    const UserModel = getUserModel();
    let userExists = false;
    
    if (UserModel) {
      try {
        const user = await UserModel.findByPk(req.user.id);
        userExists = !!user;
        console.log(`POST /todos - Vérification de l'existence de l'utilisateur ${req.user.id}: ${userExists ? 'Trouvé' : 'Non trouvé'}`);
        
        if (!userExists) {
          return res.status(400).json({ 
            error: 'Session invalide', 
            details: 'Votre compte utilisateur semble ne plus exister. Veuillez vous reconnecter.'
          });
        }
      } catch (userCheckError) {
        console.error('POST /todos - Erreur lors de la vérification de l\'utilisateur:', userCheckError);
        // On continue malgré l'erreur mais on log
      }
    }
    
    // Ajouter l'ID de l'utilisateur connecté
    todoData.userId = req.user.id;
    
    // Debug de l'ID utilisateur
    console.log(`POST /todos - Association avec l'utilisateur ID: ${todoData.userId}, utilisateur vérifié: ${userExists}`);
    
    // S'assurer que dueDate est au bon format (YYYY-MM-DD) pour le stockage
    if (todoData.dueDate) {
      try {
        // Si format DD/MM/YYYY, convertir en YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(todoData.dueDate)) {
          const [day, month, year] = todoData.dueDate.split('/');
          todoData.dueDate = `${year}-${month}-${day}`;
        } 
        // Vérifier si la date est valide
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(todoData.dueDate)) {
          // Essayer de parser la date
          const date = new Date(todoData.dueDate);
          if (!isNaN(date.getTime())) {
            todoData.dueDate = date.toISOString().split('T')[0];
          } else {
            // Si la date n'est pas valide, utiliser la date actuelle
            const today = new Date();
            todoData.dueDate = today.toISOString().split('T')[0];
          }
        }
      } catch (error) {
        console.error('Erreur lors du traitement de la date:', error);
      }
    }
    
    // Normaliser les données pour éviter les erreurs de validation
    
    // Vérifier et normaliser la catégorie
    if (todoData.category) {
      // Liste des catégories valides dans le modèle
      const validCategories = ['maison', 'courses', 'santé', 'travail', 'famille', 'autre'];
      // Convertir la catégorie en minuscules et retirer les accents
      let normalizedCategory = todoData.category.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Si la catégorie n'est pas valide, utiliser 'autre'
      if (!validCategories.includes(normalizedCategory)) {
        console.log(`POST /todos - Catégorie non valide: "${todoData.category}" -> normalisée en "autre"`);
        todoData.category = 'autre';
      } else {
        todoData.category = normalizedCategory;
      }
    }

    // Vérifier et normaliser la priorité
    if (todoData.priority) {
      // Liste des priorités valides dans le modèle
      const validPriorities = ['low', 'medium', 'high'];
      const normalizedPriority = todoData.priority.toLowerCase();
      
      // Si la priorité n'est pas valide, utiliser 'medium'
      if (!validPriorities.includes(normalizedPriority)) {
        console.log(`POST /todos - Priorité non valide: "${todoData.priority}" -> normalisée en "medium"`);
        todoData.priority = 'medium';
      } else {
        todoData.priority = normalizedPriority;
      }
    }
    
    // Vérifier les notifications et l'email
    if (todoData.notificationsEnabled && (!todoData.notificationEmail || !todoData.notificationEmail.trim())) {
      console.log(`POST /todos - Notifications activées mais email manquant -> notifications désactivées`);
      todoData.notificationsEnabled = false;
      todoData.notificationEmail = null;
    }
    
    // NOUVELLE PARTIE : Vérifier s'il s'agit d'une mise à jour (id présent) ou d'une création
    if (todoData.id) {
      console.log(`POST /todos - Détection d'une mise à jour pour la tâche existante ID: ${todoData.id}`);
      
      try {
        // Vérifier que l'utilisateur peut modifier cette tâche
        const existingTodo = await todoPgService.getTodoById(todoData.id, req.user.id);
        
        if (!existingTodo) {
          console.log(`POST /todos - Tâche ID ${todoData.id} non trouvée ou appartient à un autre utilisateur`);
          return res.status(404).json({ 
            error: 'Tâche non trouvée ou non autorisée',
            details: 'Cette tâche n\'existe pas ou ne vous appartient pas'
          });
        }
        
        // Mettre à jour la tâche existante
        const updatedTodo = await todoPgService.updateTodo(todoData.id, todoData, req.user.id);
        console.log(`POST /todos - Tâche ID ${todoData.id} mise à jour avec succès via POST`);
        
        return res.status(200).json(updatedTodo);
      } catch (updateError) {
        console.error(`POST /todos - Erreur lors de la mise à jour de la tâche ${todoData.id}:`, updateError);
        
        if (updateError.message.includes('non trouvée') || updateError.message.includes('non autorisée')) {
          return res.status(404).json({ error: 'Tâche non trouvée ou non autorisée' });
        }
        
        // Détection améliorée des erreurs de validation Sequelize
        if (updateError.name === 'SequelizeValidationError' || updateError.name === 'SequelizeUniqueConstraintError') {
          const validationErrors = updateError.errors.map(err => err.message).join(', ');
          console.error('POST /todos - Erreur de validation Sequelize:', validationErrors);
          return res.status(400).json({
            error: 'Erreur de validation',
            details: validationErrors
          });
        }
        
        return res.status(500).json({ 
          error: 'Erreur lors de la mise à jour de la tâche',
          details: updateError.message
        });
      }
    }
    
    // Sinon, c'est une création normale
    try {
      const newTodo = await todoPgService.createTodo(todoData);
      console.log('POST /todos - Tâche créée avec succès:', newTodo.id);
      res.status(201).json(newTodo);
    } catch (error) {
      console.error('POST /todos - Erreur détaillée lors de la création:', error);
      
      // Gestion améliorée des erreurs Sequelize
      if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
        const validationErrors = error.errors.map(err => err.message).join(', ');
        console.error('POST /todos - Erreur de validation Sequelize:', validationErrors);
        return res.status(400).json({
          error: 'Erreur de validation',
          details: validationErrors
        });
      }
      
      if (error.message && error.message.includes('foreign key constraint')) {
        console.error('Violation de la contrainte de clé étrangère - userId:', todoData.userId);
        return res.status(400).json({ 
          error: 'Impossible de créer la tâche: votre session semble invalide', 
          details: 'Référence utilisateur invalide, veuillez vous reconnecter'
        });
      }
      // Relancer l'erreur pour qu'elle soit traitée par le bloc catch principal
      throw error;
    }
  } catch (error) {
    console.error('Erreur lors de la création de la tâche:', error);
    
    // Vérifier si c'est une erreur de validation
    if (error.message && error.message.includes('validation')) {
      return res.status(400).json({ 
        error: 'Erreur de validation', 
        details: error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la création de la tâche',
      details: error.message
    });
  }
});

// Récupérer une tâche spécifique (protégé par authentification)
router.get('/:id', protect, async (req, res) => {
  try {
    // Passer l'ID utilisateur pour vérifier l'accès
    const todo = await todoPgService.getTodoById(req.params.id, req.user.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Tâche non trouvée ou non autorisée' });
    }
    
    res.json(todo);
  } catch (error) {
    console.error(`Erreur lors de la récupération de la tâche ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération de la tâche',
      details: error.message
    });
  }
});

// Mettre à jour une tâche (protégé par authentification)
router.put('/:id', protect, async (req, res) => {
  try {
    // Passer l'ID utilisateur pour vérifier l'accès
    const updatedTodo = await todoPgService.updateTodo(req.params.id, req.body, req.user.id);
    res.json(updatedTodo);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la tâche ${req.params.id}:`, error);
    
    if (error.message.includes('non trouvée') || error.message.includes('non autorisée')) {
      return res.status(404).json({ error: 'Tâche non trouvée ou non autorisée' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la tâche',
      details: error.message
    });
  }
});

// Supprimer une tâche (protégé par authentification)
router.delete('/:id', protect, async (req, res) => {
  try {
    // Passer l'ID utilisateur pour vérifier l'accès
    await todoPgService.deleteTodo(req.params.id, req.user.id);
    res.json({ success: true, message: 'Tâche supprimée avec succès' });
  } catch (error) {
    console.error(`Erreur lors de la suppression de la tâche ${req.params.id}:`, error);
    
    if (error.message.includes('non trouvée') || error.message.includes('non autorisée')) {
      return res.status(404).json({ error: 'Tâche non trouvée ou non autorisée' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de la tâche',
      details: error.message
    });
  }
});

module.exports = router; 