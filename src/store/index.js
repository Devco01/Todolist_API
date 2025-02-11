import { createStore } from 'vuex'
import axios from '../utils/axios'

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
      state.todos = todos;
    },
    ADD_TODO(state, todo) {
      state.todos.unshift(todo);
    },
    UPDATE_TODO(state, todo) {
      const index = state.todos.findIndex(t => t._id === todo._id);
      if (index !== -1) state.todos.splice(index, 1, todo);
    },
    DELETE_TODO(state, id) {
      state.todos = state.todos.filter(t => t._id !== id);
    }
  },
  actions: {
    async fetchTodos({ commit }) {
      const { data } = await axios.get('/todos');
      commit('SET_TODOS', data);
    },
    async createTodo({ commit }, todo) {
      const { data } = await axios.post('/todos', todo);
      commit('ADD_TODO', data);
    },
    async updateTodo({ commit }, todo) {
      const { data } = await axios.put(`/todos/${todo._id}`, todo);
      commit('UPDATE_TODO', data);
    },
    async deleteTodo({ commit }, id) {
      await axios.delete(`/todos/${id}`);
      commit('DELETE_TODO', id);
    }
  }
}) 