import { createStore } from 'vuex'
import axios from 'axios'
import axiosInstance from '../utils/axios'

const API_URL = 'http://localhost:3000/api'

// Fonction pour charger les todos du localStorage
const loadTodosFromStorage = () => {
  const savedTodos = localStorage.getItem('todos')
  return savedTodos ? JSON.parse(savedTodos) : []
}

export default createStore({
  state: {
    todos: []
  },
  getters: {
    // Nouveau getter pour trier les todos
    sortedTodos: (state) => {
      return [...state.todos].sort((a, b) => {
        // Convertir date et heure en timestamp pour comparaison
        const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`).getTime();
        const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`).getTime();
        return dateA - dateB; // Tri croissant (plus proche au plus lointain)
      });
    },
    // Nouveau getter pour calculer l'urgence
    isUrgent: () => (todo) => {
      const now = new Date().getTime();
      const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`).getTime();
      const hoursLeft = (dueDate - now) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    }
  },
  mutations: {
    SET_TODOS(state, todos) {
      state.todos = Array.isArray(todos) ? todos : [];
      localStorage.setItem('todos', JSON.stringify(state.todos));
    },
    ADD_TODO(state, todo) {
      state.todos.unshift(todo)
      localStorage.setItem('todos', JSON.stringify(state.todos))
    },
    UPDATE_TODO(state, updatedTodo) {
      const index = state.todos.findIndex(t => t._id === updatedTodo._id)
      if (index !== -1) {
        state.todos.splice(index, 1, updatedTodo)
        localStorage.setItem('todos', JSON.stringify(state.todos))
      }
    },
    DELETE_TODO(state, todoId) {
      if (!Array.isArray(state.todos)) {
        state.todos = [];
      }
      state.todos = state.todos.filter(t => t._id !== todoId);
      localStorage.setItem('todos', JSON.stringify(state.todos));
    }
  },
  actions: {
    async fetchTodos({ commit }) {
      try {
        const { data } = await axiosInstance.get('/todos')
        commit('SET_TODOS', data)
      } catch (error) {
        console.error('Erreur détaillée:', error.response?.data || error)
        const savedTodos = loadTodosFromStorage()
        commit('SET_TODOS', savedTodos)
      }
    },
    async createTodo({ commit }, todo) {
      try {
        console.log('Envoi de la todo:', todo)
        const { data } = await axiosInstance.post('/todos', todo)
        commit('ADD_TODO', data)
        return true
      } catch (error) {
        console.error('Erreur détaillée:', error.response?.data || error)
        const newTodo = { ...todo, _id: Date.now().toString() }
        commit('ADD_TODO', newTodo)
        return false
      }
    },
    async deleteTodo({ commit }, todoId) {
      try {
        await axiosInstance.delete(`/todos/${todoId}`);
        commit('DELETE_TODO', todoId);
        return true;
      } catch (error) {
        console.error('Erreur détaillée:', error.response?.data || error);
        // Ne pas commit si l'appel API échoue
        return false;
      }
    },
    async updateTodo({ commit }, todo) {
      try {
        const { data } = await axiosInstance.put(`/todos/${todo._id}`, todo)
        commit('UPDATE_TODO', data)
        return true
      } catch (error) {
        console.error('Erreur détaillée:', error.response?.data || error)
        commit('UPDATE_TODO', todo) // Met à jour localement quand même
        return false
      }
    }
  }
}) 