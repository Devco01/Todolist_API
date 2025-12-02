const { connectPostgres, getSequelize } = require('../config/postgres');
const { getTodoModel, syncTodoModel } = require('../models/TodoPg');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Variable pour garder une trace des todos en mémoire 
// (utilisé comme fallback si la connexion à la base de données échoue)
let inMemoryTodos = [];

// Initialiser la connexion à la base de données et le modèle
const init = async () => {
  try {
    // CRITIQUE: Ne PAS appeler connectPostgres() ici si déjà appelé ailleurs
    // Utiliser getSequelize() qui retourne l'instance existante
    const sequelize = getSequelize();
    if (!sequelize) {
      // Seulement alors essayer de se connecter
      const connection = await connectPostgres();
      if (!connection) {
        console.error('[TODOPG] Échec de connexion à PostgreSQL');
        return false;
      }
    } else {
      console.log('[TODOPG] Réutilisation de la connexion PostgreSQL existante');
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
              "userId" VARCHAR(255),
              "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
              "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
          `);
          console.log('[TODOPG] Table Todo créée manuellement avec succès');
          
          // MIGRATION FORCÉE: Récupérer les todos depuis le fichier local et les insérer dans la base de données
          try {
            const todosFilePath = path.join(__dirname, '../../todos-data.json');
            if (fs.existsSync(todosFilePath)) {
              const todosData = JSON.parse(fs.readFileSync(todosFilePath, 'utf8'));
              if (todosData && todosData.todos && Array.isArray(todosData.todos) && todosData.todos.length > 0) {
                console.log(`[TODOPG] MIGRATION: ${todosData.todos.length} tâches trouvées dans le fichier local`);
                
                // Récupérer le modèle Todo
                const TodoModel = getTodoModel();
                if (TodoModel) {
                  // Insérer chaque todo dans la base de données
                  for (const todo of todosData.todos) {
                    try {
                      await TodoModel.create({
                        ...todo,
                        // S'assurer que ces champs sont définis correctement
                        dueDate: todo.dueDate || null,
                        completed: todo.completed || false,
                        notificationsEnabled: todo.notificationsEnabled || false,
                      });
                      console.log(`[TODOPG] MIGRATION: Tâche "${todo.title}" insérée avec succès`);
                    } catch (insertError) {
                      console.error(`[TODOPG] MIGRATION: Erreur lors de l'insertion de la tâche "${todo.title}":`, insertError);
                    }
                  }
                  console.log('[TODOPG] MIGRATION: Fin de la migration des tâches locales');
                }
              }
            }
          } catch (migrationError) {
            console.error('[TODOPG] MIGRATION: Erreur lors de la migration des tâches locales:', migrationError);
          }
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
    console.log(`[TODOPG] Recherche des tâches pour l'utilisateur: ${userId}`);
    
    // Vérifier si la base de données est disponible
    if (isModelAvailable()) {
      const sequelize = getSequelize();
      const TodoModel = getTodoModel();
      
      // Log détaillé pour débogage
      console.log(`[TODOPG] Requête SQL préparée pour: userId=${userId}`);
      
      // MODIFICATION: Ne retourner QUE les tâches de l'utilisateur spécifique
      // Sans inclure les tâches sans userId
      const [todosBruts] = await sequelize.query(`
        SELECT * FROM "Todo" 
        WHERE "userId" = '${userId.replace(/'/g, "''")}'
        ORDER BY "createdAt" DESC
      `);
      
      console.log(`[TODOPG] Requête SQL a trouvé ${todosBruts.length} tâches pour l'utilisateur ${userId}`);
      
      // Requête alternative avec Sequelize si disponible
      let todosSequelize = [];
      try {
        todosSequelize = await TodoModel.findAll({
          where: {
            userId // Uniquement les tâches de l'utilisateur
          },
          order: [['createdAt', 'DESC']]
        });
        
        console.log(`[TODOPG] Requête Sequelize a trouvé ${todosSequelize.length} tâches`);
      } catch (seqError) {
        console.error('[TODOPG] Erreur dans la requête Sequelize:', seqError);
      }
      
      // Utiliser les résultats de la requête SQL brute
      const userTodos = todosBruts.map(todo => {
        // Convertir les champs booléens qui peuvent être stockés comme strings
        const convertedTodo = {...todo};
        if (typeof convertedTodo.completed === 'string') {
          convertedTodo.completed = convertedTodo.completed === 'true' || convertedTodo.completed === 't';
        }
        if (typeof convertedTodo.notificationsEnabled === 'string') {
          convertedTodo.notificationsEnabled = convertedTodo.notificationsEnabled === 'true' || convertedTodo.notificationsEnabled === 't';
        }
        if (typeof convertedTodo.notificationSent === 'string') {
          convertedTodo.notificationSent = convertedTodo.notificationSent === 'true' || convertedTodo.notificationSent === 't';
        }
        
        // Assurer la compatibilité en ajoutant _id
        if (!convertedTodo._id && convertedTodo.id) {
          convertedTodo._id = convertedTodo.id;
        }
        
        return convertedTodo;
      });
      
      // Mise à jour des todos en mémoire pour cet utilisateur
      inMemoryTodos = [...userTodos];
      
      console.log(`[TODOPG] Renvoi de ${userTodos.length} tâches à l'utilisateur ${userId}`);
      return userTodos;
    } else {
      // Si la base de données n'est pas disponible, filtrer les todos en mémoire pour cet utilisateur
      console.log(`[TODOPG] Base de données non disponible, utilisation des ${inMemoryTodos.length} tâches en mémoire`);
      
      // MODIFICATION: Ne retourner QUE les tâches de l'utilisateur spécifique
      return inMemoryTodos.filter(todo => todo.userId === userId);
    }
  } catch (error) {
    console.error('[TODOPG] Erreur lors de la récupération des todos par utilisateur:', error);
    
    // MODIFICATION: Ne retourner QUE les tâches de l'utilisateur spécifique
    return inMemoryTodos.filter(todo => todo.userId === userId);
  }
};

// Récupérer toutes les tâches (pour la compatibilité ou l'admin)
const getAllTodos = async () => {
  try {
    // Vérifier si la base de données est disponible
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      const sequelize = getSequelize();
      
      // Utiliser une requête SQL brute pour éviter les problèmes
      const [todosBruts] = await sequelize.query(`
        SELECT * FROM "Todo" 
        ORDER BY "createdAt" DESC
      `);
      
      console.log(`[TODOPG] getAllTodos: Trouvé ${todosBruts.length} tâches via SQL brut`);
      
      // Convertir les résultats bruts
      const todos = todosBruts.map(todo => {
        // Convertir les champs booléens qui peuvent être stockés comme strings
        const convertedTodo = {...todo};
        if (typeof convertedTodo.completed === 'string') {
          convertedTodo.completed = convertedTodo.completed === 'true' || convertedTodo.completed === 't';
        }
        if (typeof convertedTodo.notificationsEnabled === 'string') {
          convertedTodo.notificationsEnabled = convertedTodo.notificationsEnabled === 'true' || convertedTodo.notificationsEnabled === 't';
        }
        if (typeof convertedTodo.notificationSent === 'string') {
          convertedTodo.notificationSent = convertedTodo.notificationSent === 'true' || convertedTodo.notificationSent === 't';
        }
        
        // Assurer la compatibilité en ajoutant _id
        if (!convertedTodo._id && convertedTodo.id) {
          convertedTodo._id = convertedTodo.id;
        }
        
        return convertedTodo;
      });
      
      // Mettre à jour les todos en mémoire
      inMemoryTodos = todos;
      
      return todos;
    } else {
      // Si la base de données n'est pas disponible, retourner les todos en mémoire
      console.log(`[TODOPG] getAllTodos: Base de données non disponible, utilisation des ${inMemoryTodos.length} tâches en mémoire`);
      return inMemoryTodos;
    }
  } catch (error) {
    console.error('[TODOPG] Erreur lors de la récupération des todos:', error);
    return inMemoryTodos;
  }
};

// Récupérer une tâche par son ID avec vérification utilisateur
const getTodoById = async (id, userId = null) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // MODIFICATION: Si userId est fourni, n'autoriser que l'accès aux tâches de cet utilisateur
      if (userId) {
        // Utiliser findOne avec une condition sur l'ID et l'utilisateur
        const todo = await TodoModel.findOne({
          where: {
            id: id,
            userId: userId
          }
        });
        return todo;
      } else {
        // Cas administrateur ou sans restriction
        const todo = await TodoModel.findByPk(id);
        return todo;
      }
    } else {
      // MODIFICATION: Si userId est fourni, n'autoriser que l'accès aux tâches de cet utilisateur
      if (userId) {
        return inMemoryTodos.find(todo => todo.id === id && todo.userId === userId);
      } else {
        // Cas administrateur ou sans restriction
        return inMemoryTodos.find(todo => todo.id === id);
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la récupération du todo ${id}:`, error);
    return null;
  }
};

// Créer une nouvelle tâche
const createTodo = async (todoData) => {
  try {
    // Normaliser les données de la tâche pour éviter les erreurs de validation
    const normalizedData = { ...todoData };

    // Vérifier et normaliser la catégorie
    if (normalizedData.category) {
      // Liste des catégories valides dans le modèle
      const validCategories = ['maison', 'courses', 'santé', 'travail', 'famille', 'autre'];
      // Convertir la catégorie en minuscules et retirer les accents
      let normalizedCategory = normalizedData.category.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Si la catégorie n'est pas valide, utiliser 'autre'
      if (!validCategories.includes(normalizedCategory)) {
        console.log(`[TODOPG] Catégorie non valide: "${normalizedData.category}" -> normalisée en "autre"`);
        normalizedData.category = 'autre';
      } else {
        normalizedData.category = normalizedCategory;
      }
    } else {
      normalizedData.category = 'autre';
    }

    // Vérifier et normaliser la priorité
    if (normalizedData.priority) {
      // Liste des priorités valides dans le modèle
      const validPriorities = ['low', 'medium', 'high'];
      const normalizedPriority = normalizedData.priority.toLowerCase();
      
      // Si la priorité n'est pas valide, utiliser 'medium'
      if (!validPriorities.includes(normalizedPriority)) {
        console.log(`[TODOPG] Priorité non valide: "${normalizedData.priority}" -> normalisée en "medium"`);
        normalizedData.priority = 'medium';
      } else {
        normalizedData.priority = normalizedPriority;
      }
    } else {
      normalizedData.priority = 'medium';
    }
    
    // Vérifier la notification email
    if (normalizedData.notificationsEnabled && (!normalizedData.notificationEmail || !normalizedData.notificationEmail.trim())) {
      console.log(`[TODOPG] Notifications activées mais email manquant -> notifications désactivées`);
      normalizedData.notificationsEnabled = false;
      normalizedData.notificationEmail = null;
    }

    // Vérifier si l'ID utilisateur est présent et valide
    if (normalizedData.userId) {
      // Vérifier le format d'UUID seulement en mode base de données
      if (process.env.USE_MEMORY_MODE !== 'true') {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(normalizedData.userId)) {
          console.warn(`[TODOPG] Format d'ID utilisateur non valide pour création: ${normalizedData.userId}`);
          
          // En mode production, considérer comme erreur
          if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_INVALID_USERS) {
            throw new Error('ID utilisateur non valide');
          }
        }
      }
    }
    
    console.log('[TODOPG] Création d\'une tâche pour l\'utilisateur:', normalizedData.userId);
    console.log('[TODOPG] Données normalisées:', JSON.stringify(normalizedData));
    
    // Utiliser le modèle Sequelize si disponible
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Vérifier si c'est le modèle en mémoire ou le modèle Sequelize
      if (TodoModel.isUsingMemoryMode) {
        console.log('[TODOPG] Utilisation du modèle en mémoire pour la création');
      } else {
        console.log('[TODOPG] Utilisation du modèle Sequelize pour la création');
      }
      
      // Créer la tâche
      const newTodo = await TodoModel.create(normalizedData);
      
      // Si c'est un objet Sequelize, le convertir en objet JS simple
      const todoObject = newTodo.toJSON ? newTodo.toJSON() : newTodo;
      
      // Ajouter à la liste en mémoire (pour sauvegarde)
      const existingIndex = inMemoryTodos.findIndex(t => t.id === todoObject.id);
      if (existingIndex >= 0) {
        inMemoryTodos[existingIndex] = todoObject;
      } else {
        inMemoryTodos.push(todoObject);
      }
      
      return todoObject;
    } else {
      // Mode mémoire de secours
      console.log('[TODOPG] Modèle non disponible, création directe en mémoire');
      
      // Créer un identifiant unique
      const id = Date.now().toString();
      
      // Créer la tâche en mémoire
      const newTodo = {
        id,
        ...normalizedData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Ajouter à la liste en mémoire
      inMemoryTodos.push(newTodo);
      
      return newTodo;
    }
  } catch (error) {
    console.error('Erreur lors de la création du todo:', error);
    
    // Si c'est une erreur de clé étrangère, c'est probablement lié à l'utilisateur
    if (error.message && (
        error.message.includes('foreign key constraint') || 
        error.message.includes('violates foreign key')
    )) {
      console.error('[TODOPG] Erreur de contrainte de clé étrangère pour userId:', todoData.userId);
      
      // Si on est en mode tolérant, créer quand même en désassociant l'utilisateur
      if (process.env.ALLOW_INVALID_USERS === 'true' || process.env.USE_MEMORY_MODE === 'true') {
        console.log('[TODOPG] Mode tolérant activé, création sans userId');
        
        // Créer sans l'ID utilisateur
        const { userId, ...todoWithoutUser } = todoData;
        
        // Réessayer la création
        return createTodo(todoWithoutUser);
      }
    }
    
    throw error;
  }
};

// Mettre à jour une tâche existante avec vérification utilisateur
const updateTodo = async (id, updateData, userId = null) => {
  try {
    console.log(`[TODOPG] updateTodo - ID: ${id}, userId: ${userId}`);
    
    // Vérifier si la connexion DB est disponible avant d'essayer
    const sequelize = getSequelize();
    if (!sequelize) {
      console.log(`[TODOPG] updateTodo - Pas de connexion DB, utilisation mémoire`);
      
      // Mettre à jour en mémoire
      const index = inMemoryTodos.findIndex(t => {
        if (t.id != id && t._id != id) return false;
        if (userId && t.userId !== userId) return false;
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
    
    // Tester la connexion avant de continuer
    try {
      await Promise.race([
        sequelize.authenticate(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
      ]);
    } catch (authError) {
      console.warn(`[TODOPG] updateTodo - Connexion DB non disponible:`, authError.message);
      
      // Fallback sur mémoire
      const index = inMemoryTodos.findIndex(t => {
        if (t.id != id && t._id != id) return false;
        if (userId && t.userId !== userId) return false;
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
    
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Construire la clause where - MODIFICATION: uniquement les tâches de l'utilisateur
      const whereClause = {};
      
      // Gérer les deux formats d'ID (string et number)
      if (typeof id === 'string' && !isNaN(id)) {
        whereClause.id = parseInt(id);
      } else {
        whereClause.id = id;
      }
      
      if (userId) {
        // Ne récupérer que les tâches appartenant à cet utilisateur
        whereClause.userId = userId;
      }
      
      console.log(`[TODOPG] updateTodo - Clause where:`, JSON.stringify(whereClause));
      
      // Trouver la tâche avec la condition d'utilisateur si spécifiée
      const todo = await TodoModel.findOne({ where: whereClause });
      
      if (!todo) {
        console.warn(`[TODOPG] updateTodo - Tâche ${id} non trouvée avec where:`, whereClause);
        throw new Error('Tâche non trouvée ou non autorisée');
      }
      
      // Mettre à jour les champs
      await todo.update(updateData);
      
      // Recharger pour avoir les valeurs à jour
      await todo.reload();
      
      // Mettre à jour la version en mémoire
      const todoJson = todo.toJSON();
      const index = inMemoryTodos.findIndex(t => 
        (t.id && t.id == id) || (t._id && t._id == id)
      );
      if (index !== -1) {
        inMemoryTodos[index] = todoJson;
      }
      
      console.log(`[TODOPG] updateTodo - Mise à jour réussie pour ${id}`);
      return todo;
    } else {
      // Mettre à jour en mémoire - MODIFICATION: uniquement les tâches de l'utilisateur
      const index = inMemoryTodos.findIndex(t => {
        // Vérifier l'ID et que la tâche appartient à l'utilisateur
        if (t.id != id && t._id != id) return false;
        if (userId && t.userId !== userId) return false;
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
    console.error(`[TODOPG] Erreur lors de la mise à jour du todo ${id}:`, error.message || error);
    
    // Si c'est déjà une erreur métier, la relancer telle quelle
    if (error.message && (
      error.message.includes('non trouvée') || 
      error.message.includes('non autorisée')
    )) {
      throw error;
    }
    
    // Erreurs de connexion DB
    if (error.name === 'SequelizeConnectionError' || 
        error.name === 'SequelizeConnectionRefusedError' ||
        error.message?.includes('connection') ||
        error.message?.includes('Connection')) {
      throw new Error('Base de données non disponible');
    }
    
    // Autres erreurs
    throw error;
  }
};

// Supprimer une tâche avec vérification utilisateur
const deleteTodo = async (id, userId = null) => {
  try {
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Construire la clause where - MODIFICATION: uniquement les tâches de l'utilisateur
      const whereClause = { id };
      if (userId) {
        // Ne récupérer que les tâches appartenant à cet utilisateur
        whereClause.userId = userId;
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
      // Vérifier si la tâche existe et appartient à l'utilisateur - MODIFICATION
      const todoToDelete = inMemoryTodos.find(t => {
        if (t.id !== id) return false;
        if (userId && t.userId !== userId) return false;
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
    // Vérifier si la connexion DB est disponible avant d'essayer
    const sequelize = getSequelize();
    if (!sequelize) {
      console.log('[TODOPG] getTodosWithPendingNotifications: Pas de connexion DB, utilisation mémoire');
      return inMemoryTodos.filter(todo => 
        todo.notificationsEnabled && 
        !todo.completed && 
        todo.dueDate);
    }
    
    // Tester la connexion
    try {
      await sequelize.authenticate();
    } catch (authError) {
      console.warn('[TODOPG] getTodosWithPendingNotifications: Connexion DB non disponible:', authError.message);
      return inMemoryTodos.filter(todo => 
        todo.notificationsEnabled && 
        !todo.completed && 
        todo.dueDate);
    }
    
    if (isModelAvailable()) {
      const TodoModel = getTodoModel();
      
      // Trouver tous les todos non complétés avec notifications activées
      // Même si notificationSent=true, on inclut les tâches pour vérification
      try {
        const todos = await TodoModel.findAll({
          where: {
            notificationsEnabled: true,
            completed: false,
            dueDate: { [Op.not]: null }
          }
        });
        
        console.log(`[TODOPG] getTodosWithPendingNotifications: ${todos.length} tâches trouvées`);
        return todos;
      } catch (queryError) {
        console.error('[TODOPG] Erreur lors de la requête findAll:', queryError.message);
        // Fallback sur mémoire en cas d'erreur de requête
        return inMemoryTodos.filter(todo => 
          todo.notificationsEnabled && 
          !todo.completed && 
          todo.dueDate);
      }
    } else {
      // Filtrer les todos en mémoire
      console.log('[TODOPG] getTodosWithPendingNotifications: Modèle non disponible, utilisation mémoire');
      return inMemoryTodos.filter(todo => 
        todo.notificationsEnabled && 
        !todo.completed && 
        todo.dueDate);
    }
  } catch (error) {
    console.error('[TODOPG] Erreur lors de la récupération des todos avec notifications:', error.message);
    // Toujours retourner un tableau vide plutôt que de lancer une erreur
    return inMemoryTodos.filter(todo => 
      todo.notificationsEnabled && 
      !todo.completed && 
      todo.dueDate) || [];
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