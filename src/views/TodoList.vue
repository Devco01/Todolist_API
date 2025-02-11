<template>
  <div class="todo-list">
    <h1>
      <svg class="header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
      </svg>
      Liste de tâches à réaliser
    </h1>
    
    <!-- Formulaire d'ajout -->
    <form @submit.prevent="addTodo" class="add-todo-form">
      <input 
        v-model="newTodo.title" 
        placeholder="Nouvelle tâche..."
        required
      >
      <div class="datetime-inputs">
        <div class="date-group">
          <label>Date :</label>
          <input 
            type="date" 
            v-model="newTodo.dueDate"
          >
        </div>
        <div class="time-group">
          <label>Heure :</label>
          <div class="time-selects">
            <select v-model="newTodo.hours" class="time-select">
              <option v-for="hour in 24" :key="hour-1" :value="String(hour-1).padStart(2, '0')">
                {{ String(hour-1).padStart(2, '0') }}
              </option>
            </select>
            <span class="time-separator">:</span>
            <select v-model="newTodo.minutes" class="time-select">
              <option v-for="minute in 12" :key="(minute-1)*5" :value="String((minute-1)*5).padStart(2, '0')">
                {{ String((minute-1)*5).padStart(2, '0') }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <select v-model="newTodo.category">
        <option value="maison">Maison</option>
        <option value="courses">Courses</option>
        <option value="santé">Santé</option>
        <option value="famille">Famille</option>
        <option value="autre">Autre</option>
      </select>
      <button type="submit">Ajouter</button>
    </form>

    <div v-if="loading" class="loading">
      Chargement...
    </div>
    <div v-else-if="error" class="error">
      {{ error }}
      <button @click="retryLoading">Réessayer</button>
    </div>

    <!-- Liste des tâches -->
    <div class="todos">
      <div 
        v-for="todo in sortedTodos" 
        :key="todo._id"
        :class="[
          'todo-item',
          todo.priority,
          { 'urgent': isUrgent(todo) && !todo.completed }
        ]"
      >
        <input 
          type="checkbox" 
          :checked="todo.completed"
          @change="toggleTodo(todo)"
        >
        <div class="todo-content">
          <h3>
            <span class="category-icon" v-html="getCategoryIcon(todo.category)"></span>
            {{ todo.title }}
            <span v-if="isUrgent(todo) && !todo.completed" class="urgent-badge">
              Urgent
            </span>
          </h3>
          <p v-if="todo.description">{{ todo.description }}</p>
          <div class="todo-meta">
            <span class="category">{{ todo.category }}</span>
            <span class="due-date" v-if="todo.dueDate">
              Pour le: {{ formatDateTime(todo.dueDate, todo.dueTime) }}
            </span>
          </div>
        </div>
        <button @click="deleteTodo(todo._id)" class="delete-btn">
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useStore } from 'vuex'
import TodoForm from '../components/TodoForm.vue'
import TodoItem from '../components/TodoItem.vue'
import { mapGetters } from 'vuex'

// Icônes SVG
const icons = {
  maison: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 3L4 9v12h16V9l-8-6zm0 2.25l6 4.5v9.75H6V9.75l6-4.5z"/>
  </svg>`,
  courses: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 3h4l1 11h14l1-11h4l-1 13H5L4 3zm16 15c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>`,
  santé: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
  </svg>`,
  famille: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63C19.68 7.55 18.92 7 18.06 7h-.12c-.86 0-1.63.55-1.9 1.37l-.86 2.58c1.08.6 1.82 1.73 1.82 3.05v8h3zm-7.5-10.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-7H9V9c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v6h1.5v7h4zm6.5 0v-4h1v-4c0-.82-.68-1.5-1.5-1.5h-2c-.82 0-1.5.68-1.5 1.5v4h1v4h3z"/>
  </svg>`,
  autre: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
  </svg>`
}

export default {
  name: 'TodoList',
  setup() {
    const store = useStore()

    // Fonctions utilitaires
    const getTodayDate = () => {
      const today = new Date()
      return today.toISOString().split('T')[0]
    }

    const getCurrentTime = () => {
      const now = new Date();
      return {
        hours: String(now.getHours()).padStart(2, '0'),
        minutes: String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')
      };
    }

    // État local
    const newTodo = ref({
      title: '',
      category: 'autre',
      dueDate: getTodayDate(),
      hours: getCurrentTime().hours,
      minutes: getCurrentTime().minutes
    })

    // Méthodes
    const formatDateTime = (date, time) => {
      if (!date) return ''
      const dateObj = new Date(date)
      const formattedDate = dateObj.toLocaleDateString('fr-FR')
      return time ? `${formattedDate} à ${time}` : formattedDate
    }

    const addTodo = async () => {
      try {
        const result = await store.dispatch('createTodo', newTodo.value);
        if (result.success) {
          // Réinitialiser le formulaire
          const currentTime = getCurrentTime();
          newTodo.value = {
            title: '',
            category: 'autre',
            dueDate: getTodayDate(),
            hours: currentTime.hours,
            minutes: currentTime.minutes
          };
        } else {
          alert(result.message || 'Erreur lors de la création de la tâche');
        }
      } catch (error) {
        alert('Une erreur est survenue. Veuillez réessayer.');
      }
    }

    const getCategoryIcon = (category) => {
      return icons[category] || icons.autre
    }

    const deleteTodo = async (todoId) => {
      if (confirm('Êtes-vous sûr de vouloir supprimer cette tâche ?')) {
        try {
          const result = await store.dispatch('deleteTodo', todoId);
          if (!result.success) {
            alert(result.message || 'Erreur lors de la suppression de la tâche');
          }
        } catch (error) {
          alert('Une erreur est survenue lors de la suppression.');
        }
      }
    }

    const toggleTodo = async (todo) => {
      try {
        const updatedTodo = {
          ...todo,
          completed: !todo.completed
        }
        const success = await store.dispatch('updateTodo', updatedTodo)
        if (!success) {
          alert('La mise à jour n\'a pas pu être synchronisée avec le serveur')
        }
      } catch (error) {
        console.error('Erreur lors de la mise à jour:', error)
      }
    }

    onMounted(() => {
      store.dispatch('fetchTodos')
    })

    return {
      sortedTodos: computed(() => store.getters.sortedTodos),
      isUrgent: computed(() => store.getters.isUrgent),
      newTodo,
      addTodo,
      deleteTodo,
      toggleTodo,
      formatDateTime,
      getCategoryIcon,
      loading: computed(() => store.getters.loading),
      error: computed(() => store.getters.error),
      retryLoading: () => store.dispatch('fetchTodos')
    }
  }
}
</script>

<style scoped>
.todo-list {
  position: relative;
  max-width: 800px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 20px 30px;
  background: linear-gradient(
    to right,
    rgba(240, 248, 255, 0.95) 0%,
    rgba(240, 248, 255, 0.99) 10%,
    rgba(240, 248, 255, 0.99) 90%,
    rgba(240, 248, 255, 0.95) 100%
  );
  border-radius: 0 0 15px 15px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 51, 0.5),
    inset 0 0 30px rgba(0, 0, 51, 0.1);
  z-index: 1;
}

h1 {
  color: #1e90ff;
  text-align: center;
  margin-top: 10px;
  margin-bottom: 30px;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
  font-size: 2.2em;
}

.add-todo-form {
  display: grid;
  gap: 10px;
  margin-bottom: 20px;
  padding: 20px;
  background: #f0f8ff; /* Alice blue */
  border-radius: 12px;
  box-shadow: 0 3px 10px rgba(30, 144, 255, 0.2);
}

input, select {
  padding: 10px;
  border: 1px solid #4169e1; /* Royal blue */
  border-radius: 6px;
  background-color: #fff;
}

button[type="submit"] {
  background-color: #4169e1;
  color: white;
  padding: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}

button[type="submit"]:hover {
  background-color: #1e90ff;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 3px 8px rgba(0, 51, 102, 0.15);
  border: 1px solid #b0e0e6; /* Powder blue */
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.todo-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0, 51, 102, 0.2);
}

.todo-item.haute,
.todo-item.moyenne,
.todo-item.basse {
  border-left: 4px solid #4169e1;
}

.todo-item.urgent {
  border-left: 4px solid #ff4444;
  background: linear-gradient(
    to right,
    rgba(255, 68, 68, 0.02) 0%,
    rgba(255, 255, 255, 1) 50%,
    rgba(255, 68, 68, 0.02) 100%
  );
  box-shadow: 0 3px 8px rgba(255, 68, 68, 0.2);
}

.todo-content {
  flex: 1;
  margin: 0 15px;
}

.todo-content h3 {
  color: #1e90ff;
  margin-bottom: 5px;
}

.todo-meta {
  font-size: 0.9em;
  color: #4682b4; /* Steel blue */
}

.category {
  background: #b0e0e6;
  padding: 4px 8px;
  border-radius: 4px;
  margin-right: 8px;
  color: #191970; /* Midnight blue */
}

.delete-btn {
  padding: 6px 12px;
  background: #4682b4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.delete-btn:hover {
  background: #191970;
}

/* Style pour la checkbox */
input[type="checkbox"] {
  width: 20px;
  height: 20px;
  border: 2px solid #4169e1;
  border-radius: 4px;
  cursor: pointer;
}

/* Style pour la date */
.due-date {
  color: #4682b4;
  font-style: italic;
}

.header-icon {
  width: 40px;
  height: 40px;
  vertical-align: middle;
  margin-right: 10px;
  color: #4169e1;
}

.category-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  vertical-align: middle;
  margin-right: 8px;
  color: #4169e1;
}

.urgent-badge {
  background-color: #ff4444;
  color: white;
  font-size: 0.8em;
  padding: 3px 10px;
  border-radius: 12px;
  margin-left: 10px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(255, 68, 68, 0.2);
}

.datetime-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.date-group, .time-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.date-group label, .time-group label {
  font-size: 0.9em;
  color: #4682b4;
  font-weight: 500;
}

input[type="date"], input[type="time"] {
  padding: 8px;
  border: 1px solid #4169e1;
  border-radius: 6px;
  background-color: #fff;
  color: #1e90ff;
  font-family: inherit;
}

/* Style spécifique pour les sélecteurs de date et heure sur mobile */
@media (max-width: 768px) {
  .datetime-inputs {
    grid-template-columns: 1fr;
  }
  
  input[type="date"], input[type="time"] {
    min-height: 44px; /* Pour une meilleure accessibilité sur mobile */
  }
}

/* Conteneur des todos */
.todos {
  margin-top: 20px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
  padding-right: 10px;
}

/* Ajustements responsifs */
@media (max-width: 1400px) {
  .todo-list {
    margin: 0 auto;
    max-width: 700px;
  }
}

@media (max-width: 1200px) {
  .todo-list {
    margin: 0 20px;
    border-radius: 15px;
    max-width: 100%;
  }
}

.time-selects {
  display: flex;
  align-items: center;
  gap: 5px;
}

.time-select {
  padding: 8px;
  border: 1px solid #4169e1;
  border-radius: 6px;
  background-color: #fff;
  color: #1e90ff;
  font-family: inherit;
  width: calc(50% - 10px);
  cursor: pointer;
}

.time-separator {
  color: #4169e1;
  font-weight: bold;
  font-size: 1.2em;
}

.loading, .error {
  text-align: center;
  padding: 20px;
  margin: 20px 0;
  border-radius: 8px;
}

.loading {
  background: #f0f0f0;
}

.error {
  background: #ffe6e6;
  color: #d00;
}

/* Images de fond */
.todo-list::before,
.todo-list::after {
  content: '';
  position: fixed;
  top: 0;
  bottom: 0;
  width: calc((100vw - 900px) / 2);
  height: 100vh;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
  z-index: -1;
  opacity: 0.95;
}

.todo-list::before {
  left: 0;
  background-image: url('/images/Fond_écran_1.jpg');
  box-shadow: inset -10px 0 30px rgba(0, 0, 51, 0.8);
  mask-image: linear-gradient(to right, rgba(0,0,0,1) 80%, rgba(0,0,0,0));
  -webkit-mask-image: linear-gradient(to right, rgba(0,0,0,1) 80%, rgba(0,0,0,0));
}

.todo-list::after {
  right: 0;
  background-image: url('/images/Fond-écran_2.jpg');
  box-shadow: inset 10px 0 30px rgba(0, 0, 51, 0.8);
  mask-image: linear-gradient(to left, rgba(0,0,0,1) 80%, rgba(0,0,0,0));
  -webkit-mask-image: linear-gradient(to left, rgba(0,0,0,1) 80%, rgba(0,0,0,0));
}
</style> 