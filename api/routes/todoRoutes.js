const router = require('express').Router();
const Todo = require('../models/Todo');
const db = require('../config/db');
const emailService = require('../services/emailService');

// Charger les todos sauvegardés en mémoire au démarrage
let inMemoryTodos = [];
try {
  inMemoryTodos = db.loadBackupTodos() || [];
  console.log(`${inMemoryTodos.length} todos chargés en mémoire`);
} catch (error) {
  console.error('Erreur lors du chargement des todos:', error);
  inMemoryTodos = [];
}
let isMongoConnected = false;

// Vérifier si MongoDB est connecté
const checkMongoConnection = () => {
  try {
    isMongoConnected = Todo.db && Todo.db.readyState === 1;
  } catch (error) {
    console.log('Utilisation du stockage en mémoire pour les todos');
    isMongoConnected = false;
  }
  return isMongoConnected;
};

// Vérifier la connexion au démarrage
checkMongoConnection();

// Synchroniser les todos entre MongoDB et le stockage local
const syncTodosWithMongoDB = async () => {
  if (checkMongoConnection()) {
    try {
      // Charger tous les todos de MongoDB
      const mongoTodos = await Todo.find().sort({ createdAt: -1 });
      
      // Si des todos existent en mémoire mais pas dans MongoDB, les ajouter à MongoDB
      if (inMemoryTodos.length > 0) {
        for (const memoryTodo of inMemoryTodos) {
          const existsInMongo = mongoTodos.some(mt => 
            mt._id.toString() === memoryTodo._id.toString() || 
            (mt.title === memoryTodo.title && 
             mt.createdAt === memoryTodo.createdAt)
          );
          
          if (!existsInMongo) {
            try {
              const newTodo = new Todo(memoryTodo);
              await newTodo.save();
              console.log(`Todo synchronisé avec MongoDB: ${memoryTodo.title}`);
            } catch (err) {
              console.error(`Erreur lors de la synchronisation avec MongoDB: ${err}`);
            }
          }
        }
      }
      
      // Mettre à jour les todos en mémoire avec ceux de MongoDB
      inMemoryTodos = mongoTodos;
      safelyBackupTodos();
      
      console.log('Synchronisation avec MongoDB terminée');
      return true;
    } catch (error) {
      console.error('Erreur lors de la synchronisation avec MongoDB:', error);
      return false;
    }
  }
  return false;
};

// Tenter de synchroniser au démarrage
syncTodosWithMongoDB().catch(console.error);

// Générer un ID unique pour les todos en mémoire
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Ajouter cette fonction utilitaire en haut du fichier
const safelyBackupTodos = (todos) => {
  try {
    // Vérifier si on est dans un environnement Vercel pour éviter les logs inutiles
    if (process.env.VERCEL === '1') {
      return; // Ne pas essayer de sauvegarder sur Vercel
    }
    
    db.saveBackupTodos(todos || inMemoryTodos);
  } catch (error) {
    console.warn('Impossible de sauvegarder les todos localement:', error);
  }
};

// Récupérer toutes les tâches
router.get('/', async (req, res) => {
  try {
    if (checkMongoConnection()) {
      const todos = await Todo.find().sort({ createdAt: -1 });
      
      // Mettre à jour la sauvegarde locale
      inMemoryTodos = todos;
      safelyBackupTodos();
      
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
    
    // Normaliser le format de date si nécessaire
    const todoData = { ...req.body };
    
    // S'assurer que dueDate est au bon format (YYYY-MM-DD) pour le stockage
    if (todoData.dueDate) {
      try {
        // Si format DD/MM/YYYY, convertir en YYYY-MM-DD
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(todoData.dueDate)) {
          const [day, month, year] = todoData.dueDate.split('/');
          todoData.dueDate = `${year}-${month}-${day}`;
          console.log('Date convertie:', todoData.dueDate);
        } 
        // Vérifier si la date est valide
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(todoData.dueDate)) {
          // Essayer de parser la date
          const date = new Date(todoData.dueDate);
          if (!isNaN(date.getTime())) {
            todoData.dueDate = date.toISOString().split('T')[0];
            console.log('Date normalisée:', todoData.dueDate);
          } else {
            // Si la date n'est pas valide, utiliser la date actuelle
            console.warn('Date invalide, utilisation de la date actuelle:', todoData.dueDate);
            const today = new Date();
            todoData.dueDate = today.toISOString().split('T')[0];
          }
        }
      } catch (dateError) {
        console.error('Erreur lors du traitement de la date:', dateError);
        // Continuer avec la date fournie
      }
    }
    
    // Tentative de synchronisation avec MongoDB
    await syncTodosWithMongoDB().catch(console.error);
    
    if (checkMongoConnection()) {
      try {
        const todo = new Todo(todoData);
        const savedTodo = await todo.save();
        
        // Ajouter à la mémoire et sauvegarder localement
        inMemoryTodos.unshift(savedTodo);
        safelyBackupTodos();
        
        res.status(201).json(savedTodo);
      } catch (dbError) {
        console.error('MongoDB error:', dbError);
        // Fallback vers le stockage en mémoire en cas d'erreur MongoDB
        const newTodo = {
          ...todoData,
          _id: generateId(),
          createdAt: new Date()
        };
        inMemoryTodos.unshift(newTodo);
        safelyBackupTodos();
        res.status(201).json(newTodo);
      }
    } else {
      // Créer un todo en mémoire
      const newTodo = {
        ...todoData,
        _id: generateId(),
        createdAt: new Date()
      };
      inMemoryTodos.unshift(newTodo);
      safelyBackupTodos();
      res.status(201).json(newTodo);
    }
  } catch (error) {
    console.error('Error creating todo:', error);
    
    // Erreurs de validation Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    // Renvoyer une erreur explicite
    return res.status(500).json({ 
      error: 'Erreur lors de la création de la tâche',
      details: error.message
    });
  }
});

// Mettre à jour une tâche
router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Tentative de synchronisation avec MongoDB
    await syncTodosWithMongoDB().catch(console.error);
    
    if (checkMongoConnection()) {
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
        
        // Mettre à jour en mémoire et sauvegarder localement
        const index = inMemoryTodos.findIndex(t => t._id.toString() === id);
        if (index !== -1) {
          inMemoryTodos[index] = todo;
          safelyBackupTodos();
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
        safelyBackupTodos();
        res.json(inMemoryTodos[index]);
      }
    } else {
      // Mise à jour en mémoire
      const index = inMemoryTodos.findIndex(t => t._id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Tâche non trouvée' });
      }
      
      inMemoryTodos[index] = { ...inMemoryTodos[index], ...req.body };
      safelyBackupTodos();
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
      safelyBackupTodos();
      return res.json(inMemoryTodos[index]);
    }
    
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la tâche' });
  }
});

// Supprimer une tâche
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Tentative de synchronisation avec MongoDB
    await syncTodosWithMongoDB().catch(console.error);
    
    if (checkMongoConnection()) {
      try {
        // Validation de l'ID pour MongoDB
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({ error: 'ID de tâche invalide' });
        }
        
        const todo = await Todo.findByIdAndDelete(id);
        
        if (!todo) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        // Supprimer de la mémoire et sauvegarder localement
        inMemoryTodos = inMemoryTodos.filter(t => t._id.toString() !== id);
        safelyBackupTodos();
        
        res.json({ success: true, message: 'Tâche supprimée avec succès' });
      } catch (dbError) {
        console.error('MongoDB error:', dbError);
        // Fallback vers le stockage en mémoire en cas d'erreur MongoDB
        const initialLength = inMemoryTodos.length;
        inMemoryTodos = inMemoryTodos.filter(t => t._id !== id);
        safelyBackupTodos();
        
        if (inMemoryTodos.length === initialLength) {
          return res.status(404).json({ error: 'Tâche non trouvée' });
        }
        
        res.json({ success: true, message: 'Tâche supprimée avec succès' });
      }
    } else {
      // Suppression en mémoire
      const initialLength = inMemoryTodos.length;
      inMemoryTodos = inMemoryTodos.filter(t => t._id !== id);
      safelyBackupTodos();
      
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
    safelyBackupTodos();
    
    if (inMemoryTodos.length !== initialLength) {
      return res.json({ success: true, message: 'Tâche supprimée avec succès' });
    }
    
    res.status(500).json({ error: 'Erreur lors de la suppression de la tâche' });
  }
});

// Ajouter une nouvelle route pour configurer les paramètres d'email
router.post('/configure-email', async (req, res) => {
  try {
    const { email, password, host, port } = req.body;
    
    // Validation de base
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email et mot de passe sont requis' 
      });
    }
    
    // Configurer le service d'email avec les informations fournies
    const result = emailService.configureEmailSettings({
      email,
      password,
      host,
      port
    });
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Erreur lors de la configuration email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors de la configuration des paramètres d\'email',
      details: error.message
    });
  }
});

// Ajouter une route pour tester l'email
router.post('/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email de test requis' 
      });
    }
    
    // Créer une tâche factice pour tester l'envoi d'email
    const testTodo = {
      title: 'Test de notification email',
      description: 'Ceci est un email de test pour vérifier votre configuration.',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
      category: 'autre',
      priority: 'medium',
      notificationEmail: email
    };
    
    const result = await emailService.sendTaskNotification(testTodo);
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error('Erreur lors du test d\'email:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du test d\'email',
      details: error.message
    });
  }
});

module.exports = router; 