<template>
  <div class="todo-app">
    <header class="app-header">
      <div class="container">
        <h1 class="app-title">
          <svg class="header-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
          </svg>
          <span>Liste de tâches</span>
        </h1>
        <div v-if="isOfflineMode" class="offline-indicator">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
          <span>Mode hors ligne</span>
        </div>
      </div>
    </header>
    
    <main class="app-content">
      <div class="container">
        <section class="todo-form-section">
          <TodoForm />
        </section>
        
        <section class="todo-list-section">
          <div class="todo-controls">
            <div class="search-filter">
              <input 
                v-model="searchQuery" 
                type="text" 
                placeholder="Rechercher une tâche..." 
                class="search-input"
              >
            </div>
            
            <div class="filters">
              <div class="filter-group">
                <label>Statut</label>
                <select v-model="statusFilter" class="filter-select">
                  <option value="all">Tous</option>
                  <option value="active">À faire</option>
                  <option value="completed">Terminées</option>
                </select>
              </div>
              
              <div class="filter-group">
                <label>Catégorie</label>
                <select v-model="categoryFilter" class="filter-select">
                  <option value="all">Toutes</option>
                  <option value="maison">Maison</option>
                  <option value="courses">Courses</option>
                  <option value="santé">Santé</option>
                  <option value="travail">Travail</option>
                  <option value="famille">Famille</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              
              <div class="filter-group">
                <label>Priorité</label>
                <select v-model="priorityFilter" class="filter-select">
                  <option value="all">Toutes</option>
                  <option value="high">Haute</option>
                  <option value="medium">Moyenne</option>
                  <option value="low">Basse</option>
                </select>
              </div>
              
              <div class="filter-group">
                <label>Tri</label>
                <select v-model="sortBy" class="filter-select">
                  <option value="dueDate">Date d'échéance</option>
                  <option value="priority">Priorité</option>
                  <option value="title">Titre</option>
                  <option value="createdAt">Date de création</option>
                </select>
              </div>
            </div>
          </div>
          
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner"></div>
            <p>Chargement des tâches...</p>
          </div>
          
          <div v-else-if="error" class="error-container">
            <div class="error-icon">⚠️</div>
            <p>{{ error }}</p>
            <button @click="fetchTodos" class="retry-btn">Réessayer</button>
          </div>
          
          <div v-else-if="filteredTodos.length === 0" class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            <h3>Aucune tâche trouvée</h3>
            <p v-if="hasFiltersActive">Essayez de modifier vos filtres pour voir plus de résultats.</p>
            <p v-else>Commencez par ajouter une nouvelle tâche.</p>
          </div>
          
          <TransitionGroup 
            name="todo-list" 
            tag="div" 
            class="todos-container"
            v-else
          >
            <TodoItem 
              v-for="todo in filteredTodos" 
              :key="todo._id"
              :todo="todo"
              @delete="confirmDeleteTodo(todo._id)"
              @edit="openEditModal(todo)"
            />
          </TransitionGroup>
        </section>
      </div>
    </main>
    
    <!-- Modal d'édition -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-content" @click.stop>
        <h2 class="modal-title">Modifier la tâche</h2>
        
        <form @submit.prevent="updateTodo" class="edit-form">
          <div class="form-group">
            <label for="edit-title">Titre</label>
            <input 
              id="edit-title"
              v-model="editingTodo.title"
              type="text"
              required
              class="form-control"
            >
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="edit-dueDate">Date d'échéance</label>
              <input 
                id="edit-dueDate"
                v-model="editingTodo.dueDate"
                type="date"
                class="form-control"
              >
            </div>
            
            <div class="form-group">
              <label for="edit-dueTime">Heure</label>
              <div class="time-input">
                <select 
                  id="edit-hours"
                  v-model="editHours"
                  class="form-control time-select"
                >
                  <option v-for="hour in 24" :key="`edit-hour-${hour-1}`" :value="String(hour-1).padStart(2, '0')">
                    {{ String(hour-1).padStart(2, '0') }}
                  </option>
                </select>
                <span class="time-separator">:</span>
                <select 
                  id="edit-minutes"
                  v-model="editMinutes"
                  class="form-control time-select"
                >
                  <option v-for="minute in 12" :key="`edit-minute-${(minute-1)*5}`" :value="String((minute-1)*5).padStart(2, '0')">
                    {{ String((minute-1)*5).padStart(2, '0') }}
                  </option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label for="edit-category">Catégorie</label>
            <select 
              id="edit-category"
              v-model="editingTodo.category"
              class="form-control"
            >
              <option value="maison">Maison</option>
              <option value="courses">Courses</option>
              <option value="santé">Santé</option>
              <option value="travail">Travail</option>
              <option value="famille">Famille</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="edit-description">Description (optionnelle)</label>
            <textarea
              id="edit-description"
              v-model="editingTodo.description"
              class="form-control"
              rows="3"
            ></textarea>
          </div>
          
          <div class="form-group">
            <label for="edit-priority">Priorité</label>
            <div class="priority-selector">
              <button 
                type="button" 
                class="priority-btn" 
                :class="{ active: editingTodo.priority === 'low' }"
                @click="editingTodo.priority = 'low'"
              >
                Basse
              </button>
              <button 
                type="button" 
                class="priority-btn" 
                :class="{ active: editingTodo.priority === 'medium' }"
                @click="editingTodo.priority = 'medium'"
              >
                Moyenne
              </button>
              <button 
                type="button" 
                class="priority-btn" 
                :class="{ active: editingTodo.priority === 'high' }"
                @click="editingTodo.priority = 'high'"
              >
                Haute
              </button>
            </div>
          </div>
          
          <div class="modal-actions">
            <button type="button" @click="closeEditModal" class="cancel-btn">Annuler</button>
            <button type="submit" class="save-btn">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Modal de confirmation de suppression -->
    <div v-if="showDeleteModal" class="modal-overlay" @click="cancelDelete">
      <div class="modal-content delete-modal" @click.stop>
        <h2 class="modal-title">Confirmer la suppression</h2>
        <p>Êtes-vous sûr de vouloir supprimer cette tâche ?</p>
        <div class="modal-actions">
          <button @click="cancelDelete" class="cancel-btn">Annuler</button>
          <button @click="deleteTodo" class="delete-btn">Supprimer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue'
import { useStore } from 'vuex'
import TodoForm from '../components/TodoForm.vue'
import TodoItem from '../components/TodoItem.vue'

export default {
  name: 'TodoList',
  components: {
    TodoForm,
    TodoItem
  },
  setup() {
    const store = useStore()
    
    // État
    const searchQuery = ref('')
    const statusFilter = ref('all')
    const categoryFilter = ref('all')
    const priorityFilter = ref('all')
    const sortBy = ref('dueDate')
    const showEditModal = ref(false)
    const showDeleteModal = ref(false)
    const todoToDeleteId = ref(null)
    const editingTodo = ref({})
    const editHours = ref('12')
    const editMinutes = ref('00')
    
    // État du mode hors ligne
    const isOfflineMode = computed(() => store.state.isOfflineMode)
    
    // Computed
    const todos = computed(() => store.state.todos)
    const loading = computed(() => store.state.loading)
    const error = computed(() => store.state.error)
    
    const filteredTodos = computed(() => {
      let result = todos.value;
      
      // Filtre par recherche
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(todo => 
          todo.title.toLowerCase().includes(query) || 
          (todo.description && todo.description.toLowerCase().includes(query))
        );
      }
      
      // Filtre par statut
      if (statusFilter.value !== 'all') {
        const isCompleted = statusFilter.value === 'completed';
        result = result.filter(todo => todo.completed === isCompleted);
      }
      
      // Filtre par catégorie
      if (categoryFilter.value !== 'all') {
        result = result.filter(todo => todo.category === categoryFilter.value);
      }
      
      // Filtre par priorité
      if (priorityFilter.value !== 'all') {
        result = result.filter(todo => todo.priority === priorityFilter.value);
      }
      
      // Tri
      return sortTodos(result, sortBy.value);
    });
    
    const hasFiltersActive = computed(() => {
      return searchQuery.value !== '' || 
        statusFilter.value !== 'all' || 
        categoryFilter.value !== 'all' || 
        priorityFilter.value !== 'all';
    });
    
    // Méthodes
    const sortTodos = (todos, sortKey) => {
      return [...todos].sort((a, b) => {
        if (sortKey === 'dueDate') {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          
          const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`).getTime();
          const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`).getTime();
          return dateA - dateB;
        } 
        else if (sortKey === 'priority') {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        else if (sortKey === 'title') {
          return a.title.localeCompare(b.title);
        }
        else if (sortKey === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return 0;
      });
    };
    
    const fetchTodos = async () => {
      await store.dispatch('fetchTodos');
    };
    
    const confirmDeleteTodo = (id) => {
      todoToDeleteId.value = id;
      showDeleteModal.value = true;
    };
    
    const deleteTodo = async () => {
      if (todoToDeleteId.value) {
        await store.dispatch('deleteTodo', todoToDeleteId.value);
        showDeleteModal.value = false;
        todoToDeleteId.value = null;
      }
    };
    
    const cancelDelete = () => {
      showDeleteModal.value = false;
      todoToDeleteId.value = null;
    };
    
    const openEditModal = (todo) => {
      editingTodo.value = { ...todo };
      
      // Extraire les heures et minutes
      if (todo.dueTime) {
        const [hours, minutes] = todo.dueTime.split(':');
        editHours.value = hours;
        editMinutes.value = minutes;
      } else {
        editHours.value = '12';
        editMinutes.value = '00';
      }
      
      showEditModal.value = true;
    };
    
    const closeEditModal = () => {
      showEditModal.value = false;
      editingTodo.value = {};
    };
    
    const updateTodo = async () => {
      const updatedTodo = {
        ...editingTodo.value,
        dueTime: `${editHours.value}:${editMinutes.value}`
      };
      
      const result = await store.dispatch('updateTodo', updatedTodo);
      
      if (result.success) {
        closeEditModal();
      }
    };
    
    // Cycle de vie
    onMounted(() => {
      fetchTodos();
    });
    
    return {
      todos,
      loading,
      error,
      searchQuery,
      statusFilter,
      categoryFilter,
      priorityFilter,
      sortBy,
      filteredTodos,
      hasFiltersActive,
      showEditModal,
      showDeleteModal,
      editingTodo,
      editHours,
      editMinutes,
      fetchTodos,
      confirmDeleteTodo,
      deleteTodo,
      cancelDelete,
      openEditModal,
      closeEditModal,
      updateTodo,
      isOfflineMode
    };
  }
};
</script>

<style scoped>
.todo-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: var(--overlay-dark);
  color: white;
  padding: 1.5rem 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.app-title {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--accent);
}

.header-icon {
  width: 32px;
  height: 32px;
  margin-right: 0.75rem;
  filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
  color: var(--accent);
}

.app-content {
  flex: 1;
  padding: 2rem 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.todo-form-section {
  margin-bottom: 2rem;
}

.todo-controls {
  margin-bottom: 1.5rem;
  background-color: var(--overlay-light);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.search-filter {
  margin-bottom: 1rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-light);
  border-radius: var(--border-radius);
  font-size: 1rem;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.9);
}

.search-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(74, 124, 89, 0.2);
  outline: none;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.filter-group {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--dark);
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.3);
}

.filter-select {
  padding: 0.5rem;
  border: 1px solid var(--gray-light);
  border-radius: var(--border-radius);
  font-size: 0.9rem;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filter-select:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 2px rgba(74, 124, 89, 0.2);
}

.loading-container, .error-container, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  text-align: center;
  background-color: var(--overlay-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--gray-light);
  border-top: 4px solid var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-icon {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: var(--danger);
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: var(--primary);
  color: white;
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.retry-btn:hover {
  background-color: var(--secondary);
  transform: translateY(-2px);
}

.empty-state svg {
  color: var(--gray);
  margin-bottom: 1rem;
}

.empty-state h3 {
  margin-bottom: 0.5rem;
  color: var(--dark);
}

.empty-state p {
  color: var(--gray);
}

.todos-container {
  position: relative;
}

/* Animations de transition */
.todo-list-enter-active,
.todo-list-leave-active {
  transition: all 0.3s ease;
}

.todo-list-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.todo-list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: var(--border-radius);
  padding: 2rem;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.delete-modal {
  max-width: 400px;
}

.modal-title {
  margin-bottom: 1.5rem;
  color: var(--dark);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.cancel-btn {
  padding: 0.75rem 1.5rem;
  background-color: var(--gray-light);
  color: var(--gray);
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.cancel-btn:hover {
  background-color: var(--gray);
  color: white;
  transform: translateY(-2px);
}

.save-btn {
  padding: 0.75rem 1.5rem;
  background-color: var(--primary);
  color: white;
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.save-btn:hover {
  background-color: var(--secondary);
  transform: translateY(-2px);
}

.delete-btn {
  padding: 0.75rem 1.5rem;
  background-color: var(--danger);
  color: white;
  border-radius: var(--border-radius);
  transition: var(--transition);
}

.delete-btn:hover {
  background-color: #a13638;
  transform: translateY(-2px);
}

/* Responsive */
@media (max-width: 768px) {
  .app-content {
    padding: 1rem 0;
  }
  
  .container {
    padding: 0 0.75rem;
  }
  
  .app-title {
    font-size: 1.5rem;
    text-align: center;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .header-icon {
    width: 28px;
    height: 28px;
    margin-right: 0;
  }
  
  .todo-controls {
    padding: 1rem;
    margin-bottom: 1rem;
  }
  
  .search-input {
    font-size: 16px; /* Évite le zoom sur iOS */
    padding: 0.875rem;
  }
  
  .filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  
  .filter-group {
    width: 100%;
    min-width: unset;
  }
  
  .filter-group label {
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .filter-select {
    padding: 0.75rem;
    font-size: 0.9rem;
    border-radius: 6px;
  }
  
  .modal-content {
    padding: 1.5rem;
    width: 95%;
    max-width: 500px;
  }
  
  .modal-title {
    font-size: 1.25rem;
    text-align: center;
  }
  
  .edit-form {
    gap: 1rem;
  }
  
  .modal-actions {
    flex-direction: column-reverse;
    gap: 0.75rem;
  }
  
  .cancel-btn, .save-btn, .delete-btn {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
    min-height: 48px;
  }
  
  .offline-indicator {
    font-size: 0.75rem;
    padding: 0.4rem 0.8rem;
    margin-top: 0.75rem;
    justify-content: center;
  }
}

/* Styles pour très petits écrans */
@media (max-width: 480px) {
  .app-header {
    padding: 1rem 0;
  }
  
  .app-content {
    padding: 0.75rem 0;
  }
  
  .container {
    padding: 0 0.5rem;
  }
  
  .app-title {
    font-size: 1.25rem;
    gap: 0.5rem;
  }
  
  .header-icon {
    width: 24px;
    height: 24px;
  }
  
  .todo-form-section {
    margin-bottom: 1.5rem;
  }
  
  .todo-controls {
    padding: 0.875rem;
    margin-bottom: 1rem;
    border-radius: 8px;
  }
  
  .search-filter {
    margin-bottom: 1rem;
  }
  
  .search-input {
    padding: 1rem;
    font-size: 16px;
    border-radius: 8px;
    border-width: 2px;
  }
  
  .filters {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  
  .filter-group {
    background-color: rgba(255, 255, 255, 0.1);
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .filter-group label {
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--dark);
  }
  
  .filter-select {
    width: 100%;
    padding: 0.875rem;
    font-size: 1rem;
    border-radius: 8px;
    border-width: 2px;
    background-color: white;
    color: var(--dark);
  }
  
  .filter-select:focus {
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.15);
  }
  
  .loading-container, .error-container, .empty-state {
    padding: 2rem 1rem;
    border-radius: 8px;
  }
  
  .loading-spinner {
    width: 36px;
    height: 36px;
  }
  
  .error-icon {
    font-size: 1.75rem;
  }
  
  .retry-btn {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
    border-radius: 8px;
    min-height: 48px;
  }
  
  .modal-overlay {
    padding: 1rem;
    align-items: flex-start;
    padding-top: 2rem;
  }
  
  .modal-content {
    width: 100%;
    max-width: none;
    padding: 1.25rem;
    border-radius: 8px;
    max-height: calc(100vh - 4rem);
  }
  
  .delete-modal {
    max-width: none;
  }
  
  .modal-title {
    font-size: 1.125rem;
    margin-bottom: 1.25rem;
  }
  
  .edit-form {
    gap: 1rem;
  }
  
  /* Amélioration des champs du modal d'édition */
  .edit-form .form-group {
    margin-bottom: 1rem;
  }
  
  .edit-form .form-control {
    padding: 0.875rem;
    font-size: 1rem;
    border-radius: 8px;
    border-width: 2px;
  }
  
  .edit-form .form-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .edit-form .time-input {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0.75rem;
    align-items: center;
    justify-items: center;
  }
  
  .edit-form .time-select {
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 0.875rem;
  }
  
  .edit-form .time-separator {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary);
  }
}

/* Styles pour écrans extra-petits */
@media (max-width: 360px) {
  .app-header {
    padding: 0.75rem 0;
  }
  
  .container {
    padding: 0 0.375rem;
  }
  
  .app-title {
    font-size: 1.125rem;
  }
  
  .header-icon {
    width: 20px;
    height: 20px;
  }
  
  .todo-controls {
    padding: 0.75rem;
  }
  
  .search-input {
    padding: 0.875rem;
    font-size: 16px;
  }
  
  .filter-group {
    padding: 0.625rem;
  }
  
  .filter-group label {
    font-size: 0.8rem;
  }
  
  .filter-select {
    padding: 0.75rem;
    font-size: 0.95rem;
  }
  
  .modal-overlay {
    padding: 0.5rem;
    padding-top: 1rem;
  }
  
  .modal-content {
    padding: 1rem;
    border-radius: 6px;
  }
  
  .modal-title {
    font-size: 1rem;
  }
  
  .edit-form .time-input {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }
  
  .edit-form .time-separator {
    display: none;
  }
}

/* Amélioration de l'accessibilité mobile */
@media (max-width: 768px) {
  /* Amélioration du contraste */
  .todo-controls {
    background-color: var(--overlay-light);
    border: 2px solid rgba(255, 255, 255, 0.3);
  }
  
  /* Optimisation des zones tactiles */
  .retry-btn, .cancel-btn, .save-btn, .delete-btn {
    min-height: 44px;
    touch-action: manipulation;
  }
  
  /* Amélioration de la lisibilité */
  .filter-group label {
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }
  
  /* Optimisation de l'espacement */
  .todo-list-section {
    margin-top: 0.5rem;
  }
  
  /* Amélioration de l'indicateur hors ligne */
  .offline-indicator {
    font-weight: 600;
    text-align: center;
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
  }
}
</style>