const { connectPostgres } = require('../config/postgres');
const { getTodoModel, syncTodoModel } = require('../models/TodoPg');
const { Op } = require('sequelize');

// Variable pour garder une trace des todos en mémoire 
// (utilisé comme fallback si la connexion à la base de données échoue)
let inMemoryTodos = [];

// Initialiser la connexion à la base de données et le modèle
const init = async () => {
  try {
    // Connecter à PostgreSQL
    await connectPostgres();
    
    // Synchroniser le modèle (en mode non destructif)
    await syncTodoModel(false);
    
    console.log('Service todoPg initialisé avec succès');
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du service todoPg:', error);
    return false;
  }
};

// Fonction pour vérifier si le modèle est disponible
const isModelAvailable = () => {
  const TodoModel = getTodoModel();
  return !!TodoModel;
};

// Fonctions CRUD
// --------------

// Récupérer toutes les tâches
const getAllTodos = async () => {
  try {
    // Vérifier si la base de données est disponible
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const todos = await TodoModel.findAll({
        order: [['createdAt', 'DESC']]
      });
      // Mettre à jour les todos en mémoire
      inMemoryTodos = todos.map(todo => todo.toJSON());
      return todos;
    } else {
      // Si la base de données n'est pas disponible, retourner les todos en mémoire
      return inMemoryTodos;
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des todos:', error);
    return inMemoryTodos;
  }
};

// Récupérer une tâche par son ID
const getTodoById = async (id) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      return await TodoModel.findByPk(id);
    } else {
      return inMemoryTodos.find(todo => todo.id === id);
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération du todo ${id}:`, error);
    return null;
  }
};

// Créer une nouvelle tâche
const createTodo = async (todoData) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const newTodo = await TodoModel.create(todoData);
      
      // Ajouter à la mémoire
      inMemoryTodos.unshift(newTodo.toJSON());
      return newTodo;
    } else {
      // Générer un ID pour le stockage en mémoire
      const newTodo = {
        id: Date.now().toString(),
        ...todoData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      inMemoryTodos.unshift(newTodo);
      return newTodo;
    }
  } catch (error) {
    console.error('Erreur lors de la création du todo:', error);
    if (error.name === 'SequelizeValidationError') {
      throw new Error(`Erreur de validation: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};

// Mettre à jour une tâche existante
const updateTodo = async (id, updateData) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const todo = await TodoModel.findByPk(id);
      
      if (!todo) {
        throw new Error('Tâche non trouvée');
      }
      
      // Mettre à jour les champs
      await todo.update(updateData);
      
      // Mettre à jour la version en mémoire
      const index = inMemoryTodos.findIndex(t => t.id === id);
      if (index !== -1) {
        inMemoryTodos[index] = todo.toJSON();
      }
      
      return todo;
    } else {
      // Mettre à jour en mémoire
      const index = inMemoryTodos.findIndex(t => t.id === id);
      
      if (index === -1) {
        throw new Error('Tâche non trouvée');
      }
      
      inMemoryTodos[index] = {
        ...inMemoryTodos[index],
        ...updateData,
        updatedAt: new Date()
      };
      
      return inMemoryTodos[index];
    }
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du todo ${id}:`, error);
    throw error;
  }
};

// Supprimer une tâche
const deleteTodo = async (id) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const todo = await TodoModel.findByPk(id);
      
      if (!todo) {
        throw new Error('Tâche non trouvée');
      }
      
      await todo.destroy();
      
      // Supprimer de la mémoire
      inMemoryTodos = inMemoryTodos.filter(t => t.id !== id);
      
      return { success: true };
    } else {
      // Supprimer de la mémoire
      const initialLength = inMemoryTodos.length;
      inMemoryTodos = inMemoryTodos.filter(t => t.id !== id);
      
      if (inMemoryTodos.length === initialLength) {
        throw new Error('Tâche non trouvée');
      }
      
      return { success: true };
    }
  } catch (error) {
    console.error(`Erreur lors de la suppression du todo ${id}:`, error);
    throw error;
  }
};

// Récupérer les tâches avec notifications non envoyées
const getTodosWithPendingNotifications = async () => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Trouver tous les todos non complétés avec notifications activées
      // Même si notificationSent=true, on inclut les tâches pour vérification
      const todos = await TodoModel.findAll({
        where: {
          notificationsEnabled: true,
          completed: false,
          dueDate: { [Op.not]: null }
        }
      });
      
      return todos;
    } else {
      // Filtrer les todos en mémoire
      return inMemoryTodos.filter(todo => 
        todo.notificationsEnabled && 
        !todo.completed && 
        todo.dueDate);
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des todos avec notifications:', error);
    return [];
  }
};

// Marquer une notification comme envoyée
const markNotificationSent = async (todoId) => {
  try {
    return await updateTodo(todoId, { notificationSent: true });
  } catch (error) {
    console.error(`Erreur lors du marquage de la notification pour ${todoId}:`, error);
    throw error;
  }
};

module.exports = {
  init,
  getAllTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  getTodosWithPendingNotifications,
  markNotificationSent,
  isModelAvailable
}; 