const { connectPostgres, getSequelize } = require('../config/postgres');
const { getTodoModel, syncTodoModel } = require('../models/TodoPg');
const { Op } = require('sequelize');

// Variable pour garder une trace des todos en mémoire 
// (utilisé comme fallback si la connexion à la base de données échoue)
let inMemoryTodos = [];

// Initialiser la connexion à la base de données et le modèle
const init = async () => {
  try {
    // Connecter à PostgreSQL
    const connection = await connectPostgres();
    if (!connection) {
      console.error('[TODOPG] Échec de connexion à PostgreSQL');
      return false;
    }
    
    // Vérifier si la table Todo existe
    console.log('[TODOPG] Vérification de l\'existence de la table Todo');
    const sequelize = getSequelize();
    try {
      const [checkResults] = await sequelize.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'Todo'
        );
      `);
      const tableExists = checkResults[0]?.exists === true;
      console.log('[TODOPG] La table Todo existe:', tableExists);
      
      // Si la table n'existe pas, la créer manuellement
      if (!tableExists) {
        console.log('[TODOPG] Création manuelle de la table Todo avec SQL');
        try {
          await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "Todo" (
              id SERIAL PRIMARY KEY,
              title VARCHAR(255) NOT NULL,
              description TEXT,
              "dueDate" DATE,
              "dueTime" VARCHAR(255),
              category VARCHAR(255) DEFAULT 'autre',
              priority VARCHAR(255) DEFAULT 'medium',
              completed BOOLEAN DEFAULT false,
              "notificationEmail" VARCHAR(255),
              "notificationsEnabled" BOOLEAN DEFAULT false,
              "notificationSent" BOOLEAN DEFAULT false,
              "userId" UUID REFERENCES "User"(id) ON DELETE SET NULL,
              "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
          `);
          console.log('[TODOPG] Table Todo créée manuellement avec succès');
        } catch (sqlError) {
          console.error('[TODOPG] Erreur lors de la création manuelle de la table Todo:', sqlError);
          
          // Essayer avec une méthode alternative si la première échoue
          try {
            console.log('[TODOPG] Tentative alternative de création de table Todo');
            await sequelize.query(`
              CREATE TABLE IF NOT EXISTS "Todo" (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                "dueDate" VARCHAR(255),
                "dueTime" VARCHAR(255),
                category VARCHAR(255),
                priority VARCHAR(255),
                completed BOOLEAN DEFAULT false,
                "notificationEmail" VARCHAR(255),
                "notificationsEnabled" BOOLEAN DEFAULT false,
                "notificationSent" BOOLEAN DEFAULT false,
                "userId" VARCHAR(255),
                "createdAt" TIMESTAMP NOT NULL,
                "updatedAt" TIMESTAMP NOT NULL
              );
            `);
            console.log('[TODOPG] Table Todo créée avec méthode alternative');
          } catch (altError) {
            console.error('[TODOPG] Échec également de la méthode alternative:', altError);
          }
        }
      }
    } catch (checkError) {
      console.error('[TODOPG] Erreur lors de la vérification de la table:', checkError);
    }
    
    // Synchroniser le modèle (en mode non destructif)
    await syncTodoModel(false);
    
    console.log('[TODOPG] Service todoPg initialisé avec succès');
    return true;
  } catch (error) {
    console.error('[TODOPG] Erreur lors de l\'initialisation du service todoPg:', error);
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

// Récupérer toutes les tâches d'un utilisateur
const getAllTodosByUser = async (userId) => {
  try {
    // Vérifier si la base de données est disponible
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const todos = await TodoModel.findAll({
        where: {
          [Op.or]: [
            { userId }, // Tâches de l'utilisateur
            { userId: null } // Tâches sans utilisateur spécifique (compatibilité)
          ]
        },
        order: [['createdAt', 'DESC']]
      });
      
      // Mise à jour des todos en mémoire pour cet utilisateur
      const userTodos = todos.map(todo => todo.toJSON());
      return userTodos;
    } else {
      // Si la base de données n'est pas disponible, filtrer les todos en mémoire pour cet utilisateur
      return inMemoryTodos.filter(todo => 
        !todo.userId || todo.userId === userId
      );
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des todos par utilisateur:', error);
    return inMemoryTodos.filter(todo => 
      !todo.userId || todo.userId === userId
    );
  }
};

// Récupérer toutes les tâches (pour la compatibilité ou l'admin)
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

// Récupérer une tâche par son ID avec vérification utilisateur
const getTodoById = async (id, userId = null) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const todo = await TodoModel.findByPk(id);
      
      // Vérifier si la tâche appartient à l'utilisateur demandé
      if (userId && todo && todo.userId && todo.userId !== userId) {
        return null; // L'utilisateur n'a pas accès à cette tâche
      }
      
      return todo;
    } else {
      const todo = inMemoryTodos.find(todo => todo.id === id);
      
      // Vérifier si la tâche appartient à l'utilisateur demandé
      if (userId && todo && todo.userId && todo.userId !== userId) {
        return null; // L'utilisateur n'a pas accès à cette tâche
      }
      
      return todo;
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération du todo ${id}:`, error);
    return null;
  }
};

// Créer une nouvelle tâche
const createTodo = async (todoData) => {
  try {
    // Vérifier si l'ID utilisateur est présent et valide
    if (todoData.userId) {
      // Vérifier le format d'UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(todoData.userId)) {
        console.error(`[TODOPG] Format d'ID utilisateur invalide: ${todoData.userId}`);
        throw new Error(`ID utilisateur invalide: format d'UUID incorrect`);
      }
      
      // Si le modèle User est disponible, tenter de vérifier si l'utilisateur existe
      const { getUserModel } = require('../models/UserPg');
      const UserModel = getUserModel();
      
      if (UserModel) {
        try {
          const user = await UserModel.findByPk(todoData.userId);
          if (!user) {
            console.error(`[TODOPG] Utilisateur introuvable avec ID: ${todoData.userId}`);
            throw new Error(`L'utilisateur avec l'ID ${todoData.userId} n'existe pas`);
          }
        } catch (userError) {
          console.error(`[TODOPG] Erreur lors de la vérification de l'utilisateur:`, userError);
          // Ne pas bloquer la création en cas d'erreur de vérification
        }
      }
    }
    
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
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      throw new Error(`Violation de contrainte de clé étrangère: l'utilisateur spécifié n'existe pas`);
    }
    throw error;
  }
};

// Mettre à jour une tâche existante avec vérification utilisateur
const updateTodo = async (id, updateData, userId = null) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Construire la clause where
      const whereClause = { id };
      if (userId) {
        whereClause[Op.or] = [
          { userId },
          { userId: null }
        ];
      }
      
      // Trouver la tâche avec la condition d'utilisateur si spécifiée
      const todo = await TodoModel.findOne({ where: whereClause });
      
      if (!todo) {
        throw new Error('Tâche non trouvée ou non autorisée');
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
      const index = inMemoryTodos.findIndex(t => {
        // Vérifier l'ID et l'utilisateur si nécessaire
        if (t.id !== id) return false;
        if (userId && t.userId && t.userId !== userId) return false;
        return true;
      });
      
      if (index === -1) {
        throw new Error('Tâche non trouvée ou non autorisée');
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

// Supprimer une tâche avec vérification utilisateur
const deleteTodo = async (id, userId = null) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Construire la clause where
      const whereClause = { id };
      if (userId) {
        whereClause[Op.or] = [
          { userId },
          { userId: null }
        ];
      }
      
      // Trouver la tâche avec la condition d'utilisateur si spécifiée
      const todo = await TodoModel.findOne({ where: whereClause });
      
      if (!todo) {
        throw new Error('Tâche non trouvée ou non autorisée');
      }
      
      await todo.destroy();
      
      // Supprimer de la mémoire
      inMemoryTodos = inMemoryTodos.filter(t => t.id !== id);
      
      return { success: true };
    } else {
      // Vérifier si la tâche existe et appartient à l'utilisateur
      const todoToDelete = inMemoryTodos.find(t => {
        if (t.id !== id) return false;
        if (userId && t.userId && t.userId !== userId) return false;
        return true;
      });
      
      if (!todoToDelete) {
        throw new Error('Tâche non trouvée ou non autorisée');
      }
      
      // Supprimer de la mémoire
      inMemoryTodos = inMemoryTodos.filter(t => t.id !== id);
      
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
  getAllTodosByUser,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo,
  getTodosWithPendingNotifications,
  markNotificationSent
}; 