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
    
    // Ajouter l'ID de l'utilisateur connecté
    todoData.userId = req.user.id;
    
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
    
    const newTodo = await todoPgService.createTodo(todoData);
    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Erreur lors de la création de la tâche:', error);
    
    // Vérifier si c'est une erreur de validation
    if (error.message && error.message.includes('Erreur de validation:')) {
      return res.status(400).json({ error: error.message });
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