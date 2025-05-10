const router = require('express').Router();
const todoPgService = require('../services/todoPgService');

// Initialiser le service au démarrage
(async () => {
  try {
    await todoPgService.init();
    console.log('Routes todos avec PostgreSQL initialisées');
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des routes Postgres:', error);
  }
})();

// Récupérer toutes les tâches
router.get('/', async (req, res) => {
  try {
    const todos = await todoPgService.getAllTodos();
    res.json(todos);
  } catch (error) {
    console.error('Erreur lors de la récupération des todos:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des tâches',
      details: error.message
    });
  }
});

// Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    // Log des données reçues
    console.log('POST /todos - Données reçues:', JSON.stringify(req.body));
    
    // Validation de base
    if (!req.body.title || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    
    // Normaliser le format de date si nécessaire
    const todoData = { ...req.body };
    
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

// Récupérer une tâche spécifique
router.get('/:id', async (req, res) => {
  try {
    const todo = await todoPgService.getTodoById(req.params.id);
    
    if (!todo) {
      return res.status(404).json({ error: 'Tâche non trouvée' });
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

// Mettre à jour une tâche
router.put('/:id', async (req, res) => {
  try {
    const updatedTodo = await todoPgService.updateTodo(req.params.id, req.body);
    res.json(updatedTodo);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de la tâche ${req.params.id}:`, error);
    
    if (error.message === 'Tâche non trouvée') {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la mise à jour de la tâche',
      details: error.message
    });
  }
});

// Supprimer une tâche
router.delete('/:id', async (req, res) => {
  try {
    await todoPgService.deleteTodo(req.params.id);
    res.json({ success: true, message: 'Tâche supprimée avec succès' });
  } catch (error) {
    console.error(`Erreur lors de la suppression de la tâche ${req.params.id}:`, error);
    
    if (error.message === 'Tâche non trouvée') {
      return res.status(404).json({ error: 'Tâche non trouvée' });
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de la tâche',
      details: error.message
    });
  }
});

module.exports = router; 