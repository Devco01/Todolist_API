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
      console.log('Mutation SET_TODOS:', todos);
      state.todos = todos;
    },
    ADD_TODO(state, todo) {
      console.log('Mutation ADD_TODO:', todo);
      state.todos.unshift(todo);
    },
    UPDATE_TODO(state, todo) {
      console.log('Mutation UPDATE_TODO:', todo);
      const index = state.todos.findIndex(t => t._id === todo._id);
      if (index !== -1) state.todos.splice(index, 1, todo);
    },
    DELETE_TODO(state, id) {
      console.log('Mutation DELETE_TODO:', id);
      state.todos = state.todos.filter(t => t._id !== id);
    }
  },
  actions: {
    async fetchTodos({ commit }) {
      try {
        console.log('Action fetchTodos');
        const { data } = await axios.get('/todos');
        commit('SET_TODOS', data);
      } catch (error) {
        console.error('fetchTodos error:', error);
      }
    },
    async createTodo({ commit }, todo) {
      try {
        console.log('Action createTodo:', todo);
        const { data } = await axios.post('/todos', todo);
        commit('ADD_TODO', data);
        return { success: true };
      } catch (error) {
        console.error('createTodo error:', error);
        return { success: false, error };
      }
    },
    async updateTodo({ commit }, todo) {
      try {
        console.log('Action updateTodo:', todo);
        const { data } = await axios.put(`/todos/${todo._id}`, todo);
        commit('UPDATE_TODO', data);
        return { success: true };
      } catch (error) {
        console.error('updateTodo error:', error);
        return { success: false, error };
      }
    },
    async deleteTodo({ commit }, id) {
      try {
        console.log('Action deleteTodo:', id);
        await axios.delete(`/todos/${id}`);
        commit('DELETE_TODO', id);
        return { success: true };
      } catch (error) {
        console.error('deleteTodo error:', error);
        return { success: false, error };
      }
    }
  }
}) 