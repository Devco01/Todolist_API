<template>
  <div class="todo-item" :class="[todo.priority, { completed: todo.completed }]">
    <div class="todo-checkbox">
      <input 
        type="checkbox"
        :id="`todo-${todo._id}`"
        :checked="todo.completed"
        @change="toggleComplete"
        class="checkbox-input"
      >
      <label :for="`todo-${todo._id}`" class="checkbox-label"></label>
    </div>
    
    <div class="todo-content">
      <div class="todo-header">
        <h3 class="todo-title">{{ todo.title }}</h3>
        <div class="todo-badges">
          <span class="category-badge" :class="todo.category">
            {{ getCategoryLabel(todo.category) }}
          </span>
          <span v-if="isUrgent && !todo.completed" class="urgent-badge">
            Urgent
          </span>
          <span class="priority-badge" :class="todo.priority">
            {{ getPriorityLabel(todo.priority) }}
          </span>
        </div>
      </div>
      
      <p v-if="todo.description" class="todo-description">
        {{ todo.description }}
      </p>
      
      <div class="todo-meta">
        <div v-if="todo.dueDate" class="due-date">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ formatDate(todo.dueDate) }}</span>
        </div>
        
        <div v-if="todo.dueTime" class="due-time">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>{{ formatTime(todo.dueTime) }}</span>
        </div>
      </div>
    </div>
    
    <div class="todo-actions">
      <button @click="editTodo" class="action-btn edit-btn" title="Modifier">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
      <button @click="$emit('delete')" class="action-btn delete-btn" title="Supprimer">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useStore } from 'vuex'

export default {
  name: 'TodoItem',
  props: {
    todo: {
      type: Object,
      required: true
    }
  },
  emits: ['delete', 'edit'],
  setup(props, { emit }) {
    const store = useStore()

    const isUrgent = computed(() => {
      if (!props.todo.dueDate) return false;
      const now = new Date().getTime();
      const dueDate = new Date(`${props.todo.dueDate}T${props.todo.dueTime || '00:00'}`).getTime();
      const hoursLeft = (dueDate - now) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    });

    const toggleComplete = () => {
      store.dispatch('updateTodo', {
        ...props.todo,
        completed: !props.todo.completed
      });
    };

    const editTodo = () => {
      emit('edit', props.todo);
    };

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    const formatTime = (time) => {
      return time;
    };

    const getCategoryLabel = (category) => {
      const labels = {
        maison: 'Maison',
        courses: 'Courses',
        santé: 'Santé',
        travail: 'Travail',
        famille: 'Famille',
        autre: 'Autre'
      };
      return labels[category] || 'Autre';
    };

    const getPriorityLabel = (priority) => {
      const labels = {
        low: 'Basse',
        medium: 'Moyenne',
        high: 'Haute'
      };
      return labels[priority] || 'Moyenne';
    };

    return {
      isUrgent,
      toggleComplete,
      editTodo,
      formatDate,
      formatTime,
      getCategoryLabel,
      getPriorityLabel
    };
  }
};
</script>

<style scoped>
.todo-item {
  display: flex;
  align-items: flex-start;
  padding: 1.25rem;
  margin-bottom: 1rem;
  background: var(--overlay-light);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  border-left: 4px solid var(--gray-light);
  transition: var(--transition);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.todo-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
}

.todo-item.low {
  border-left-color: var(--success);
}

.todo-item.medium {
  border-left-color: var(--warning);
}

.todo-item.high {
  border-left-color: var(--danger);
}

.todo-checkbox {
  margin-right: 1rem;
  position: relative;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-label {
  display: inline-block;
  width: 22px;
  height: 22px;
  border: 2px solid var(--gray-light);
  border-radius: 4px;
  position: relative;
  cursor: pointer;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.7);
}

.checkbox-input:checked + .checkbox-label {
  background-color: var(--primary);
  border-color: var(--primary);
}

.checkbox-input:checked + .checkbox-label::after {
  content: '';
  position: absolute;
  left: 7px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.todo-content {
  flex: 1;
  min-width: 0;
}

.todo-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.todo-title {
  font-size: 1.1rem;
  margin: 0;
  margin-right: 1rem;
  color: var(--dark);
  word-break: break-word;
  font-weight: 600;
}

.completed .todo-title {
  text-decoration: line-through;
  color: var(--gray);
}

.todo-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.category-badge, .priority-badge, .urgent-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.category-badge {
  background-color: rgba(255, 255, 255, 0.8);
  color: var(--dark);
  border: 1px solid var(--gray-light);
}

.category-badge.maison {
  background-color: rgba(88, 129, 87, 0.2);
  border-color: var(--success);
  color: var(--success);
}

.category-badge.courses {
  background-color: rgba(217, 165, 87, 0.2);
  border-color: var(--warning);
  color: var(--warning);
}

.category-badge.santé {
  background-color: rgba(212, 163, 115, 0.2);
  border-color: var(--accent);
  color: var(--accent);
}

.category-badge.travail {
  background-color: rgba(74, 124, 89, 0.2);
  border-color: var(--primary);
  color: var(--primary);
}

.category-badge.famille {
  background-color: rgba(44, 85, 48, 0.2);
  border-color: var(--secondary);
  color: var(--secondary);
}

.priority-badge {
  background-color: rgba(255, 255, 255, 0.8);
  color: var(--dark);
}

.priority-badge.low {
  background-color: rgba(88, 129, 87, 0.2);
  border: 1px solid var(--success);
  color: var(--success);
}

.priority-badge.medium {
  background-color: rgba(217, 165, 87, 0.2);
  border: 1px solid var(--warning);
  color: var(--warning);
}

.priority-badge.high {
  background-color: rgba(188, 71, 73, 0.2);
  border: 1px solid var(--danger);
  color: var(--danger);
}

.urgent-badge {
  background-color: rgba(188, 71, 73, 0.2);
  border: 1px solid var(--danger);
  color: var(--danger);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(188, 71, 73, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(188, 71, 73, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(188, 71, 73, 0);
  }
}

.todo-description {
  margin: 0.5rem 0;
  font-size: 0.9rem;
  color: var(--dark);
  word-break: break-word;
  background-color: rgba(255, 255, 255, 0.5);
  padding: 0.5rem;
  border-radius: 4px;
}

.todo-meta {
  display: flex;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.85rem;
  color: var(--dark);
}

.due-date, .due-time {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.todo-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: 1rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.8);
  color: var(--gray);
  transition: var(--transition);
  border: 1px solid var(--gray-light);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.edit-btn:hover {
  background-color: var(--primary-light);
  color: white;
  border-color: var(--primary);
}

.delete-btn:hover {
  background-color: var(--danger);
  color: white;
  border-color: var(--danger);
}

.completed {
  opacity: 0.7;
}

@media (max-width: 768px) {
  .todo-header {
    flex-direction: column;
  }
  
  .todo-badges {
    margin-top: 0.5rem;
  }
  
  .todo-actions {
    flex-direction: row;
    margin-top: 0.5rem;
    margin-left: 0;
  }
}
</style>
