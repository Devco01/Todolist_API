import { createStore } from 'vuex'
import axios from '../utils/axios'

// Clé utilisée pour le stockage dans localStorage
const STORAGE_KEY = 'todos';

// Fonction pour charger les todos du localStorage avec gestion d'erreur améliorée
const loadTodosFromStorage = () => {
  try {
    const savedTodos = localStorage.getItem(STORAGE_KEY)
    console.log('[DEBUG] Chargement des todos depuis localStorage:', savedTodos ? `Données trouvées (${savedTodos.length} caractères)` : 'Aucune donnée')
    
    // Si pas de données, renvoyer un tableau vide
    if (!savedTodos) return []
    
    // Parser les données JSON
    const parsedTodos = JSON.parse(savedTodos)
    
    // Vérifier que c'est bien un tableau
    if (Array.isArray(parsedTodos)) {
      console.log(`[DEBUG] ${parsedTodos.length} todos chargés depuis localStorage`)
      return parsedTodos
    } else {
      console.error('[DEBUG] Format de données invalide dans localStorage:', parsedTodos)
      return []
    }
  } catch (error) {
    console.error('[DEBUG] Erreur lors du chargement des todos depuis localStorage:', error)
    return []
  }
}

// Fonction pour sauvegarder les todos dans le localStorage avec gestion d'erreur
const saveTodosToStorage = (todos) => {
  try {
    // Vérifier que todos est bien un tableau
    if (!Array.isArray(todos)) {
      console.error('[DEBUG] Tentative de sauvegarde de données non valides dans localStorage:', todos)
      return false
    }
    
    // Sauvegarder les données
    const jsonString = JSON.stringify(todos);
    localStorage.setItem(STORAGE_KEY, jsonString)
    
    // Vérifier que les données ont bien été sauvegardées
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData === jsonString) {
      console.log(`[DEBUG] ${todos.length} todos sauvegardés dans localStorage (${jsonString.length} caractères)`)
      return true
    } else {
      console.error('[DEBUG] Problème lors de la sauvegarde dans localStorage - Les données ne correspondent pas')
      return false
    }
  } catch (error) {
    console.error('[DEBUG] Erreur lors de la sauvegarde des todos dans localStorage:', error)
    return false
  }
}

export default createStore({
  state: {
    todos: loadTodosFromStorage(),
    loading: false,
    error: null,
    isOfflineMode: false,
    notificationStatus: null
  },
  getters: {
    sortedTodos: (state) => {
      // S'assurer que state.todos est un tableau avant de le trier
      const todos = Array.isArray(state.todos) ? state.todos : [];
      return [...todos].sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0;
        // Convertir date et heure en timestamp pour comparaison
        const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`).getTime();
        const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`).getTime();
        return dateA - dateB;
      });
    },
    isUrgent: () => (todo) => {
      if (!todo || !todo.dueDate) return false;
      const now = new Date().getTime();
      const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`).getTime();
      const hoursLeft = (dueDate - now) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    },
    todosWithNotifications: (state) => {
      return state.todos.filter(todo => todo.notificationsEnabled && !todo.completed);
    }
  },
  mutations: {
    SET_LOADING(state, value) {
      state.loading = value;
    },
    SET_ERROR(state, error) {
      state.error = error;
    },
    SET_TODOS(state, todos) {
      console.log(`[DEBUG] SET_TODOS: Mise à jour des todos avec ${Array.isArray(todos) ? todos.length : 'non-tableau'} éléments`);
      
      // S'assurer que nous avons un tableau valide
      if (!Array.isArray(todos)) {
        console.error('[DEBUG] SET_TODOS: Données non valides reçues:', todos);
        todos = [];
      }
      
      // Sauvegarder dans le state
      state.todos = todos;
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] SET_TODOS: Échec de la sauvegarde dans localStorage');
      }
    },
    ADD_TODO(state, todo) {
      console.log('[DEBUG] ADD_TODO:', todo);
      
      if (!todo) {
        console.error('[DEBUG] ADD_TODO: Tentative d\'ajout d\'une tâche nulle ou undefined');
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] ADD_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
      }
      
      // Ajouter la tâche au début du tableau
      state.todos.unshift(todo);
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] ADD_TODO: Échec de la sauvegarde dans localStorage');
      }
    },
    UPDATE_TODO(state, todo) {
      console.log('[DEBUG] UPDATE_TODO:', todo);
      
      if (!todo) {
        console.error('[DEBUG] UPDATE_TODO: Tentative de mise à jour d\'une tâche nulle ou undefined');
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] UPDATE_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
        return;
      }
      
      // Compatibilité avec MongoDB (_id) et PostgreSQL (id)
      const todoId = todo._id || todo.id;
      if (!todoId) {
        console.error('[DEBUG] UPDATE_TODO: La tâche n\'a pas d\'ID valide:', todo);
        return;
      }
      
      // Trouver l'index de la tâche à mettre à jour
      const index = state.todos.findIndex(t => 
        (t._id && t._id === todoId) || (t.id && t.id === todoId)
      );
      
      if (index !== -1) {
        state.todos.splice(index, 1, todo);
        console.log(`[DEBUG] UPDATE_TODO: Tâche mise à jour à l'index ${index}`);
      } else {
        console.error(`[DEBUG] UPDATE_TODO: Tâche avec ID ${todoId} non trouvée`);
      }
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] UPDATE_TODO: Échec de la sauvegarde dans localStorage');
      }
    },
    DELETE_TODO(state, id) {
      console.log('[DEBUG] DELETE_TODO:', id);
      
      if (!id) {
        console.error('[DEBUG] DELETE_TODO: ID non valide:', id);
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] DELETE_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
        return;
      }
      
      // Compter les éléments avant suppression
      const countBefore = state.todos.length;
      
      // On ne garde que les tâches dont ni l'id ni le _id ne correspondent à l'id à supprimer
      state.todos = state.todos.filter(todo => {
        // Si la tâche a un _id, vérifier s'il est différent de l'id à supprimer
        const _idDifferent = !todo._id || todo._id !== id;
        // Si la tâche a un id, vérifier s'il est différent de l'id à supprimer
        const idDifferent = !todo.id || todo.id !== id;
        // Garder la tâche seulement si les deux identifiants sont différents
        return _idDifferent && idDifferent;
      });
      
      // Vérifier si des éléments ont été supprimés
      const countAfter = state.todos.length;
      if (countBefore === countAfter) {
        console.warn(`[DEBUG] DELETE_TODO: Aucune tâche avec ID ${id} n'a été trouvée pour suppression`);
      } else {
        console.log(`[DEBUG] DELETE_TODO: ${countBefore - countAfter} tâche(s) supprimée(s)`);
      }
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] DELETE_TODO: Échec de la sauvegarde dans localStorage');
      }
    },
    SET_OFFLINE_MODE(state, value) {
      state.isOfflineMode = value;
    },
    SET_NOTIFICATION_STATUS(state, status) {
      state.notificationStatus = status;
    }
  },
  actions: {
    // Force le chargement des données depuis le localStorage si présent
    loadFromLocalStorageOnly({ commit }) {
      console.log('[DEBUG] Chargement de secours depuis localStorage uniquement');
      const localTodos = loadTodosFromStorage();
      
      if (localTodos && localTodos.length > 0) {
        console.log(`[DEBUG] ${localTodos.length} tâches récupérées depuis localStorage (secours)`);
        commit('SET_TODOS', localTodos);
        commit('SET_OFFLINE_MODE', true);
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: 'Données chargées depuis la sauvegarde locale'
        });
        return { success: true, data: localTodos, offline: true };
      } else {
        console.warn('[DEBUG] Aucune donnée dans localStorage pour le chargement de secours');
        return { success: false, error: 'Aucune donnée locale disponible' };
      }
    },
    async fetchTodos({ commit, dispatch }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        console.log('[DEBUG] Tentative de récupération des todos depuis le serveur...');
        const { data } = await axios.get('/todos');
        
        // Vérifier la validité des données reçues
        if (!data || !Array.isArray(data)) {
          throw new Error('Format de données invalide reçu du serveur');
        }
        
        console.log(`[DEBUG] ${data.length} todos récupérés depuis le serveur`);
        commit('SET_TODOS', data);
        commit('SET_OFFLINE_MODE', false);
        
        // Afficher un message de confirmation temporaire
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: 'Synchronisation réussie avec le serveur'
        });
        
        return { success: true, data };
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la récupération des todos:', error);
        
        const errorMessage = error.response?.data?.error || 'Erreur lors du chargement des tâches';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          console.log('[DEBUG] Pas de réponse du serveur, utilisation du stockage local');
          commit('SET_OFFLINE_MODE', true);
          const localTodos = loadTodosFromStorage();
          
          // Notification d'utilisation de données locales
          commit('SET_NOTIFICATION_STATUS', {
            success: true,
            message: 'Utilisation des données locales (mode hors ligne)'
          });
          
          commit('SET_TODOS', localTodos);
          return { success: true, data: localTodos, offline: true };
        }
        
        return { success: false, error: errorMessage };
      } finally {
        commit('SET_LOADING', false);
      }
    },
    async createTodo({ commit, state }, todo) {
      commit('SET_ERROR', null);
      commit('SET_LOADING', true);
      try {
        console.log('Store: Tentative de création de la tâche avec les données:', todo);
        
        // Validation de base côté client
        if (!todo.title || todo.title.trim() === '') {
          const errorMessage = 'Le titre de la tâche est requis';
          console.error(errorMessage);
          commit('SET_ERROR', errorMessage);
          commit('SET_LOADING', false);
          return { success: false, error: errorMessage };
        }

        const { data } = await axios.post('/todos', todo);
        console.log('Réponse API pour createTodo:', data);
        
        // Vérifier si l'ID est présent (compatibilité MongoDB/PostgreSQL)
        if (data && (data._id || data.id)) {
          // Si l'objet a seulement id mais pas _id, ajouter _id pour la compatibilité frontend
          if (data.id && !data._id) {
            data._id = data.id;
          }
          commit('ADD_TODO', data);
          commit('SET_OFFLINE_MODE', false);
          commit('SET_LOADING', false);
          return { success: true, data };
        } else {
          const errorMessage = 'Réponse invalide du serveur: ID de tâche manquant';
          console.error(errorMessage, data);
          commit('SET_ERROR', errorMessage);
          commit('SET_LOADING', false);
          return { success: false, error: errorMessage };
        }
      } catch (error) {
        console.error('Erreur dans l\'action createTodo:', error);
        
        // Extraction plus précise du message d'erreur
        let errorMessage = 'Erreur lors de la création de la tâche';
        if (error.response) {
          errorMessage = error.response.data?.error || 
                        `Erreur serveur: ${error.response.status} ${error.response.statusText}`;
          console.error(`Erreur API détaillée:`, error.response.data);
        } else if (error.request) {
          errorMessage = 'Le serveur n\'a pas répondu à la requête';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          console.log('Fallback: Utilisation du stockage local');
          commit('SET_OFFLINE_MODE', true);
          const newTodo = {
            ...todo,
            _id: Math.random().toString(36).substring(2, 15),
            createdAt: new Date().toISOString()
          };
          commit('ADD_TODO', newTodo);
          commit('SET_LOADING', false);
          return { success: true, data: newTodo, offline: true };
        }
        
        commit('SET_LOADING', false);
        return { success: false, error: errorMessage };
      }
    },
    async updateTodo({ commit, state }, todo) {
      commit('SET_ERROR', null);
      try {
        // Utiliser l'ID approprié (compatibilité MongoDB/PostgreSQL)
        const todoId = todo._id || todo.id;
        const { data } = await axios.put(`/todos/${todoId}`, todo);
        
        // Si l'objet a seulement id mais pas _id, ajouter _id pour la compatibilité frontend
        if (data.id && !data._id) {
          data._id = data.id;
        }
        
        commit('UPDATE_TODO', data);
        commit('SET_OFFLINE_MODE', false);
        return { success: true, data };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la mise à jour de la tâche';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          commit('SET_OFFLINE_MODE', true);
          commit('UPDATE_TODO', todo);
          return { success: true, data: todo, offline: true };
        }
        
        return { success: false, error: errorMessage };
      }
    },
    async deleteTodo({ commit, state }, id) {
      commit('SET_ERROR', null);
      try {
        await axios.delete(`/todos/${id}`);
        commit('DELETE_TODO', id);
        commit('SET_OFFLINE_MODE', false);
        return { success: true };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression de la tâche';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          commit('SET_OFFLINE_MODE', true);
          commit('DELETE_TODO', id);
          return { success: true, offline: true };
        }
        
        return { success: false, error: errorMessage };
      }
    },
    async updateNotificationSettings({ commit, dispatch }, { todoId, notificationsEnabled, notificationEmail }) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      try {
        const { data } = await axios.put(`/notifications/${todoId}`, {
          notificationsEnabled,
          notificationEmail
        });
        
        commit('UPDATE_TODO', data);
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: notificationsEnabled 
            ? 'Notifications activées avec succès' 
            : 'Notifications désactivées'
        });
        
        return { success: true, data };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la mise à jour des notifications';
        commit('SET_ERROR', errorMessage);
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, error: errorMessage };
      }
    },
    async testNotification({ commit }, { todoId, testEmail }) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      try {
        const { data } = await axios.post(`/notifications/test/${todoId}`, {
          testEmail
        });
        
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: 'Email de test envoyé avec succès'
        });
        
        return { success: true, message: data.message };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de l\'envoi de l\'email de test';
        commit('SET_ERROR', errorMessage);
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, error: errorMessage };
      }
    }
  }
}) 