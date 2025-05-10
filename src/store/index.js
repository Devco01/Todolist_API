import { createStore } from 'vuex'
import axios from '../utils/axios'

// Fonction pour charger les todos du localStorage
const loadTodosFromStorage = () => {
  const savedTodos = localStorage.getItem('todos')
  return savedTodos ? JSON.parse(savedTodos) : []
}

// Fonction pour sauvegarder les todos dans le localStorage
const saveTodosToStorage = (todos) => {
  localStorage.setItem('todos', JSON.stringify(todos))
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
      state.todos = Array.isArray(todos) ? todos : [];
      // Sauvegarder dans le localStorage
      saveTodosToStorage(state.todos);
    },
    ADD_TODO(state, todo) {
      if (!todo) return;
      
      if (!Array.isArray(state.todos)) state.todos = [];
      state.todos.unshift(todo);
      // Sauvegarder dans le localStorage
      saveTodosToStorage(state.todos);
    },
    UPDATE_TODO(state, todo) {
      const index = state.todos.findIndex(t => t._id === todo._id);
      if (index !== -1) state.todos.splice(index, 1, todo);
      // Sauvegarder dans le localStorage
      saveTodosToStorage(state.todos);
    },
    DELETE_TODO(state, id) {
      state.todos = state.todos.filter(t => t._id !== id);
      // Sauvegarder dans le localStorage
      saveTodosToStorage(state.todos);
    },
    SET_OFFLINE_MODE(state, value) {
      state.isOfflineMode = value;
    },
    SET_NOTIFICATION_STATUS(state, status) {
      state.notificationStatus = status;
    }
  },
  actions: {
    async fetchTodos({ commit }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      try {
        const { data } = await axios.get('/todos');
        commit('SET_TODOS', data);
        commit('SET_OFFLINE_MODE', false);
        return { success: true, data };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors du chargement des tâches';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          commit('SET_OFFLINE_MODE', true);
          const localTodos = loadTodosFromStorage();
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
      try {
        const { data } = await axios.post('/todos', todo);
        if (data && data._id) {
          commit('ADD_TODO', data);
          commit('SET_OFFLINE_MODE', false);
          return { success: true, data };
        } else {
          throw new Error('Réponse invalide du serveur');
        }
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la création de la tâche';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          commit('SET_OFFLINE_MODE', true);
          const newTodo = {
            ...todo,
            _id: Math.random().toString(36).substring(2, 15),
            createdAt: new Date().toISOString()
          };
          commit('ADD_TODO', newTodo);
          return { success: true, data: newTodo, offline: true };
        }
        
        return { success: false, error: errorMessage };
      }
    },
    async updateTodo({ commit, state }, todo) {
      commit('SET_ERROR', null);
      try {
        const { data } = await axios.put(`/todos/${todo._id}`, todo);
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
    },
    async configureEmailSettings({ commit }, emailConfig) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      try {
        const { data } = await axios.post('/todos/configure-email', emailConfig);
        
        commit('SET_NOTIFICATION_STATUS', {
          success: data.success,
          message: data.message
        });
        
        return data;
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Erreur lors de la configuration email';
        
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, message: errorMessage };
      }
    },
    
    async testEmailConfig({ commit }, testEmail) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      try {
        const { data } = await axios.post('/todos/test-email', { email: testEmail });
        
        // Ne plus ouvrir la prévisualisation dans une nouvelle fenêtre
        commit('SET_NOTIFICATION_STATUS', {
          success: data.success,
          message: data.success 
            ? `✅ Email de test envoyé avec succès à ${testEmail}` 
            : data.message
        });
        
        return data;
      } catch (error) {
        const errorMessage = error.response?.data?.message || 'Erreur lors de l\'envoi de l\'email de test';
        
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, message: errorMessage };
      }
    }
  }
}) 