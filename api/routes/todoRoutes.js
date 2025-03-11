const router = require('express').Router();
const Todo = require('../models/Todo');

// Stockage en mémoire pour le développement local
let inMemoryTodos = [];
let isMongoConnected = false;

// Vérifier si MongoDB est connecté
try {
  isMongoConnected = Todo.db && Todo.db.readyState === 1;
} catch (error) {
  console.log('Utilisation du stockage en mémoire pour les todos');
  isMongoConnected = false;
}

// Générer un ID unique pour les todos en mémoire
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Récupérer toutes les tâches
router.get('/', async (req, res) => {
  try {
    if (isMongoConnected) {
      const todos = await Todo.find().sort({ createdAt: -1 });
      res.json(todos);
    } else {
      // Utiliser le stockage en mémoire
      res.json(inMemoryTodos);
    }
  } catch (error) {
    console.error('Error fetching todos:', error);
    // En cas d'erreur, renvoyer le stockage en mémoire
    res.json(inMemoryTodos);
  }
});

// Créer une nouvelle tâche
router.post('/', async (req, res) => {
  try {
    // Validation de base
    if (!req.body.title || req.body.title.trim() === '') {
      return res.status(400).json({ error: 'Le titre est requis' });
    }
    
    if (isMongoConnected) {
      try {
        const todo = new Todo(req.body);
        const savedTodo = await todo.save();
        res.status(201).json(savedTodo);
      } catch (dbError) {
        console.error('MongoDB error:', dbError);
        // Fallback vers le stockage en mémoire en cas d'erreur MongoDB
        const newTodo = {
          ...req.body,
          _id: generateId(),
          createdAt: new Date()
        };
        inMemoryTodos.unshift(newTodo);
        res.status(201).json(newTodo);
      }
    } else {
      // Créer un todo en mémoire
      const newTodo = {
        ...req.body,
        _id: generateId(),
        createdAt: new Date()
      };
      inMemoryTodos.unshift(newTodo);
      res.status(201).json(newTodo);
    }
  } catch (error) {
    console.error('Error creating todo:', error);
    
    // Erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Essayer de créer en mémoire en cas d'erreur
    const newTodo = {
      ...req.body,
      _id: generateId(),
      createdAt: new Date()
    };
    inMemoryTodos.unshift(newTodo);
    res.status(201).json(newTodo);
  }
});

// Mettre à jour une tâche
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (isMongoConnected) {
      try {
        // Validation de l'ID pour MongoDB
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({ error: 'ID de tâche invalide' });
        }
        
        const todo = await Todo.findByIdAndUpdate(
          id,
          req.body,
          { new: true, runValidators: true }
        );
        
        if (!todo) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        res.json(todo);
      } catch (dbError) {
        console.error('MongoDB error:', dbError);
        // Fallback vers le stockage en mémoire en cas d'erreur MongoDB
        const index = inMemoryTodos.findIndex(t => t._id === id);
        if (index === -1) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        inMemoryTodos[index] = { ...inMemoryTodos[index], ...req.body };
        res.json(inMemoryTodos[index]);
      }
    } else {
      // Mise à jour en mémoire
      const index = inMemoryTodos.findIndex(t => t._id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Tâche non trouvée' });
      }
      
      inMemoryTodos[index] = { ...inMemoryTodos[index], ...req.body };
      res.json(inMemoryTodos[index]);
    }
  } catch (error) {
    console.error('Error updating todo:', error);
    
    // Erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Essayer de mettre à jour en mémoire
    const id = req.params.id;
    const index = inMemoryTodos.findIndex(t => t._id === id);
    if (index !== -1) {
      inMemoryTodos[index] = { ...inMemoryTodos[index], ...req.body };
      return res.json(inMemoryTodos[index]);
    }
    
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la tâche' });
  }
});

// Supprimer une tâche
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    if (isMongoConnected) {
      try {
        // Validation de l'ID pour MongoDB
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({ error: 'ID de tâche invalide' });
        }
        
        const todo = await Todo.findByIdAndDelete(id);
        
        if (!todo) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        res.json({ success: true, message: 'Tâche supprimée avec succès' });
      } catch (dbError) {
        console.error('MongoDB error:', dbError);
        // Fallback vers le stockage en mémoire en cas d'erreur MongoDB
        const initialLength = inMemoryTodos.length;
        inMemoryTodos = inMemoryTodos.filter(t => t._id !== id);
        
        if (inMemoryTodos.length === initialLength) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        res.json({ success: true, message: 'Tâche supprimée avec succès' });
      }
    } else {
      // Suppression en mémoire
      const initialLength = inMemoryTodos.length;
      inMemoryTodos = inMemoryTodos.filter(t => t._id !== id);
      
      if (inMemoryTodos.length === initialLength) {
        return res.status(404).json({ error: 'Tâche non trouvée' });
      }
      
      res.json({ success: true, message: 'Tâche supprimée avec succès' });
    }
  } catch (error) {
    console.error('Error deleting todo:', error);
    
    // Essayer de supprimer en mémoire
    const id = req.params.id;
    const initialLength = inMemoryTodos.length;
    inMemoryTodos = inMemoryTodos.filter(t => t._id !== id);
    
    if (inMemoryTodos.length !== initialLength) {
      return res.json({ success: true, message: 'Tâche supprimée avec succès' });
    }
    
    res.status(500).json({ error: 'Erreur lors de la suppression de la tâche' });
  }
});

module.exports = router; 