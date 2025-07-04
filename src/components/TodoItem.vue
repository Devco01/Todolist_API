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
      <button @click="toggleNotification" class="action-btn notification-btn" :title="notificationTitle" :class="{ active: todo.notificationsEnabled }">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="btn-label">Notifier</span>
      </button>
      <button @click="editTodo" class="action-btn edit-btn" title="Modifier la tâche">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        <span class="btn-label">Modifier</span>
      </button>
      <button @click="$emit('delete')" class="action-btn delete-btn" title="Supprimer la tâche">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        <span class="btn-label">Supprimer</span>
      </button>
    </div>
  </div>
  
  <!-- Modal de notification -->
  <div v-if="showNotificationModal" class="notification-modal-overlay" @click="closeNotificationModal">
    <div class="notification-modal" @click.stop>
      <h3 class="modal-title">Notification par email</h3>
      
      <div class="notification-toggle">
        <label for="notification-toggle">Activer les notifications</label>
        <div class="toggle-container">
          <input 
            type="checkbox" 
            id="notification-toggle" 
            v-model="notificationSettings.enabled"
            class="toggle-checkbox"
          >
          <label for="notification-toggle" class="toggle-label"></label>
        </div>
      </div>
      
      <div v-if="notificationSettings.enabled" class="notification-form">
        <div class="form-group">
          <label for="notification-email-input" class="form-label">Adresse email</label>
          <input 
            id="notification-email-input"
            v-model="notificationSettings.email"
            type="email"
            placeholder="Votre adresse email"
            class="form-control"
            required
          >
        </div>
        
        <p class="notification-info">
          <i class="notification-icon">ℹ️</i>
          Vous recevrez une notification 1 heure avant l'échéance de cette tâche.
        </p>
        
        <p class="notification-info">
          <i class="notification-icon">📧</i>
          Les notifications sont envoyées automatiquement sans action requise de votre part.
        </p>
      </div>
      
      <div class="modal-actions">
        <button @click="closeNotificationModal" class="cancel-btn">Annuler</button>
        <button @click="saveNotificationSettings" class="save-btn">Enregistrer</button>
      </div>
    </div>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
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
    const showNotificationModal = ref(false)
    const notificationSettings = ref({
      enabled: false,
      email: ''
    })

    const isUrgent = computed(() => {
      if (!props.todo.dueDate) return false;
      const now = new Date().getTime();
      const dueDate = new Date(`${props.todo.dueDate}T${props.todo.dueTime || '00:00'}`).getTime();
      const hoursLeft = (dueDate - now) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    });
    
    const notificationTitle = computed(() => {
      return props.todo.notificationsEnabled 
        ? 'Notifications activées' 
        : 'Configurer les notifications';
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
    
    const toggleNotification = () => {
      // Initialiser les paramètres avec les valeurs actuelles
      notificationSettings.value = {
        enabled: props.todo.notificationsEnabled || false,
        email: props.todo.notificationEmail || ''
      };
      showNotificationModal.value = true;
    };
    
    const closeNotificationModal = () => {
      showNotificationModal.value = false;
    };
    
    const saveNotificationSettings = async () => {
      // Valider l'email si les notifications sont activées
      if (notificationSettings.value.enabled && !notificationSettings.value.email) {
        alert('Veuillez saisir une adresse email valide');
        return;
      }
      
      // Mettre à jour les paramètres de notification
      try {
        await store.dispatch('updateTodo', {
          ...props.todo,
          notificationsEnabled: notificationSettings.value.enabled,
          notificationEmail: notificationSettings.value.email,
          notificationSent: false // Réinitialiser le statut d'envoi
        });
        
        // Configurer la notification de confirmation
        store.commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: notificationSettings.value.enabled 
            ? 'Notifications configurées avec succès!'
            : 'Notifications désactivées'
        });
        
        // Fermer la modal
        showNotificationModal.value = false;
      } catch (error) {
        console.error('Erreur lors de la mise à jour des notifications:', error);
        store.commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: 'Erreur lors de la configuration des notifications'
        });
      }
    };

    const formatDate = (date) => {
      if (!date) return '';
      
      // Si la date est au format YYYY-MM-DD, la convertir en DD/MM/YYYY
      if (date.includes('-')) {
        const [year, month, day] = date.split('-');
        return new Date(`${year}-${month}-${day}`).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
      
      // Si la date est déjà au format DD/MM/YYYY
      const [day, month, year] = date.split('/');
      return new Date(`${year}-${month}-${day}`).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    };

    const formatTime = (time) => {
      if (!time) return '';
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
      getPriorityLabel,
      showNotificationModal,
      notificationSettings,
      toggleNotification,
      closeNotificationModal,
      saveNotificationSettings,
      notificationTitle
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
  gap: 0.75rem;
  margin-left: 1rem;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--gray);
  transition: var(--transition);
  border: 2px solid transparent;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  font-size: 0.85rem;
  font-weight: 500;
  min-height: 36px;
  white-space: nowrap;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-label {
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.3px;
}

.notification-btn {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  color: var(--gray);
  border-color: rgba(108, 117, 125, 0.2);
}

.notification-btn:hover {
  background: linear-gradient(135deg, #e9ecef, #dee2e6);
  color: var(--dark);
  border-color: var(--gray);
}

.notification-btn.active {
  background: linear-gradient(135deg, #d4a373, #e9c46a);
  color: white;
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(212, 163, 115, 0.3);
}

.notification-btn.active:hover {
  background: linear-gradient(135deg, #c69749, #d4a373);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(212, 163, 115, 0.4);
}

.edit-btn {
  background: linear-gradient(135deg, #4a7c59, #588157);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 2px 8px rgba(74, 124, 89, 0.2);
}

.edit-btn:hover {
  background: linear-gradient(135deg, #3a6c49, #4a7c59);
  border-color: var(--secondary);
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(74, 124, 89, 0.3);
}

.edit-btn svg {
  stroke-width: 2.5;
}

.delete-btn {
  background: linear-gradient(135deg, #bc4749, #d62d20);
  color: white;
  border-color: var(--danger);
  box-shadow: 0 2px 8px rgba(188, 71, 73, 0.2);
}

.delete-btn:hover {
  background: linear-gradient(135deg, #a13638, #bc4749);
  border-color: #a13638;
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(188, 71, 73, 0.3);
}

.delete-btn svg {
  stroke-width: 2.5;
}

.completed {
  opacity: 0.7;
}

.completed .action-btn {
  opacity: 0.8;
}

.completed .action-btn:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .todo-item {
    padding: 1rem;
    margin-bottom: 0.75rem;
    flex-direction: column;
  }
  
  .todo-checkbox {
    margin-right: 0;
    margin-bottom: 0.75rem;
    align-self: flex-start;
  }
  
  .todo-content {
    width: 100%;
    margin-bottom: 0.75rem;
  }
  
  .todo-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  
  .todo-title {
    margin-right: 0;
    font-size: 1.1rem;
    line-height: 1.3;
    word-break: break-word;
  }
  
  .todo-badges {
    width: 100%;
    justify-content: flex-start;
    margin-top: 0;
    gap: 0.5rem;
  }
  
  .category-badge, .priority-badge, .urgent-badge {
    font-size: 0.75rem;
    padding: 0.35rem 0.6rem;
    border-radius: 16px;
  }
  
  .todo-description {
    margin: 0.75rem 0;
    padding: 0.75rem;
    font-size: 0.9rem;
    line-height: 1.4;
  }
  
  .todo-meta {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
    margin-top: 0.75rem;
  }
  
  .due-date, .due-time {
    font-size: 0.85rem;
    gap: 0.35rem;
  }
  
  .todo-actions {
    width: 100%;
    justify-content: center;
    gap: 1rem;
    margin-left: 0;
    margin-top: 0;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    flex-wrap: wrap;
  }
  
  .action-btn {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    min-height: 44px;
    gap: 0.5rem;
    border-radius: 8px;
    flex: 1;
    min-width: 100px;
    max-width: 120px;
  }
  
  .btn-label {
    font-size: 0.8rem;
    font-weight: 600;
  }
  
  .action-btn svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
}

/* Styles pour très petits écrans */
@media (max-width: 480px) {
  .todo-item {
    padding: 0.875rem;
    margin-bottom: 0.75rem;
    border-radius: 8px;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto auto;
    gap: 0.75rem;
    align-items: start;
  }
  
  .todo-checkbox {
    grid-column: 1;
    grid-row: 1;
    margin: 0;
    margin-top: 0.25rem;
  }
  
  .checkbox-label {
    width: 24px;
    height: 24px;
    border-width: 2px;
  }
  
  .todo-content {
    grid-column: 2;
    grid-row: 1 / 3;
    margin: 0;
    width: 100%;
    min-width: 0;
  }
  
  .todo-header {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
  
  .todo-title {
    font-size: 1.05rem;
    line-height: 1.3;
    margin: 0;
    font-weight: 600;
    word-break: break-word;
    hyphens: auto;
  }
  
  .todo-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    width: 100%;
    margin: 0;
  }
  
  .category-badge, .priority-badge, .urgent-badge {
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
    border-radius: 12px;
    font-weight: 600;
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
  
  .todo-description {
    margin: 0.75rem 0 0 0;
    padding: 0.75rem;
    font-size: 0.85rem;
    line-height: 1.4;
    border-radius: 6px;
    background-color: rgba(255, 255, 255, 0.6);
  }
  
  .todo-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
    font-size: 0.8rem;
    color: var(--gray);
  }
  
  .due-date, .due-time {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    white-space: nowrap;
    background-color: rgba(255, 255, 255, 0.4);
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }
  
  .due-date svg, .due-time svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  
  .todo-actions {
    grid-column: 1 / 3;
    grid-row: 3;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.5rem;
    margin: 0;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }
  
  .action-btn {
    padding: 0.75rem 0.5rem;
    font-size: 0.75rem;
    min-height: 48px;
    gap: 0.25rem;
    border-radius: 8px;
    flex-direction: column;
    text-align: center;
    min-width: auto;
    max-width: none;
  }
  
  .btn-label {
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.1;
  }
  
  .action-btn svg {
    width: 16px;
    height: 16px;
    margin-bottom: 0.125rem;
  }
  
  /* États terminé amélioré */
  .todo-item.completed {
    opacity: 0.6;
  }
  
  .completed .todo-title {
    text-decoration: line-through;
    color: var(--gray);
  }
  
  .completed .todo-badges {
    opacity: 0.7;
  }
}

/* Styles pour écrans extra-petits */
@media (max-width: 360px) {
  .todo-item {
    padding: 0.75rem;
    gap: 0.5rem;
  }
  
  .todo-title {
    font-size: 1rem;
    line-height: 1.25;
  }
  
  .todo-badges {
    gap: 0.3rem;
  }
  
  .category-badge, .priority-badge, .urgent-badge {
    font-size: 0.65rem;
    padding: 0.25rem 0.4rem;
    border-radius: 10px;
  }
  
  .todo-description {
    font-size: 0.8rem;
    padding: 0.6rem;
  }
  
  .todo-meta {
    gap: 0.5rem;
    font-size: 0.75rem;
  }
  
  .due-date, .due-time {
    padding: 0.2rem 0.4rem;
    font-size: 0.75rem;
  }
  
  .due-date svg, .due-time svg {
    width: 12px;
    height: 12px;
  }
  
  .todo-actions {
    gap: 0.375rem;
  }
  
  .action-btn {
    padding: 0.625rem 0.375rem;
    font-size: 0.7rem;
    min-height: 44px;
    gap: 0.2rem;
  }
  
  .btn-label {
    font-size: 0.65rem;
  }
  
  .action-btn svg {
    width: 14px;
    height: 14px;
  }
}

/* Amélioration des transitions et animations sur mobile */
@media (max-width: 768px) {
  .todo-item {
    transition: all 0.2s ease;
  }
  
  .todo-item:hover {
    transform: none; /* Désactive le hover sur mobile */
    box-shadow: var(--box-shadow);
  }
  
  .action-btn {
    transition: all 0.2s ease;
  }
  
  /* Amélioration du tap feedback */
  .action-btn:active {
    transform: scale(0.95);
  }
  
  .checkbox-label:active {
    transform: scale(0.95);
  }
  
  /* Optimisation des hover effects sur mobile */
  .action-btn:hover {
    transform: none;
  }
  
  .action-btn:active {
    transform: scale(0.95);
    opacity: 0.8;
  }
}

.notification-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(3px);
}

.notification-modal {
  background-color: white;
  border-radius: var(--border-radius);
  padding: 1.5rem;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
}

.modal-title {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: var(--dark);
  font-weight: 600;
  text-align: center;
}

.notification-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.toggle-container {
  position: relative;
  width: 50px;
  height: 24px;
}

.toggle-checkbox {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-label {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.toggle-label:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-checkbox:checked + .toggle-label {
  background-color: var(--primary);
}

.toggle-checkbox:checked + .toggle-label:before {
  transform: translateX(26px);
}

.notification-form {
  margin-top: 1rem;
}

.notification-info {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--gray);
  margin-top: 0.5rem;
  background-color: var(--light);
  padding: 0.75rem;
  border-radius: var(--border-radius);
}

.notification-icon {
  font-style: normal;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.cancel-btn, .save-btn {
  padding: 0.5rem 1rem;
  border-radius: var(--border-radius);
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition);
}

.cancel-btn {
  background-color: var(--light);
  color: var(--dark);
  border: 1px solid var(--gray-light);
}

.save-btn {
  background-color: var(--primary);
  color: white;
  border: 1px solid var(--primary);
}

.cancel-btn:hover {
  background-color: var(--gray-light);
}

.save-btn:hover {
  background-color: var(--primary-dark);
}
</style>
