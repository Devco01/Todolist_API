<template>
  <div class="todo-form">
    <h2 class="form-title">Ajouter une tâche</h2>
    <form @submit.prevent="submitForm">
      <div class="form-group">
        <label for="title" class="form-label">Titre</label>
        <input 
          id="title"
          v-model="todo.title"
          type="text"
          placeholder="Que devez-vous faire ?"
          required
          class="form-control"
        >
      </div>
      
      <div class="form-row">
        <div class="form-col">
          <div class="form-group">
            <label for="dueDate" class="form-label">Date d'échéance</label>
            <input 
              id="dueDate"
              v-model="todo.dueDate"
              type="date"
              class="form-control"
            >
          </div>
        </div>
        
        <div class="form-col">
          <div class="form-group">
            <label for="dueTime" class="form-label">Heure</label>
            <div class="time-input">
              <select 
                id="hours"
                v-model="hours"
                class="form-control"
              >
                <option v-for="hour in 24" :key="`hour-${hour-1}`" :value="String(hour-1).padStart(2, '0')">
                  {{ String(hour-1).padStart(2, '0') }}
                </option>
              </select>
              <span class="time-separator">:</span>
              <select 
                id="minutes"
                v-model="minutes"
                class="form-control"
              >
                <option v-for="minute in 12" :key="`minute-${(minute-1)*5}`" :value="String((minute-1)*5).padStart(2, '0')">
                  {{ String((minute-1)*5).padStart(2, '0') }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="form-group">
        <label for="category" class="form-label">Catégorie</label>
        <select 
          id="category"
          v-model="todo.category"
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
        <label for="description" class="form-label">Description (optionnelle)</label>
        <textarea
          id="description"
          v-model="todo.description"
          placeholder="Détails supplémentaires..."
          class="form-control"
          rows="3"
        ></textarea>
      </div>
      
      <div class="form-group">
        <label class="form-label">Priorité</label>
        <div class="priority-options">
          <div class="priority-option low">
            <input 
              type="radio" 
              id="priority-low" 
              name="priority" 
              value="low" 
              v-model="todo.priority"
              class="priority-radio"
            >
            <label for="priority-low" class="priority-label">Basse</label>
          </div>
          <div class="priority-option medium">
            <input 
              type="radio" 
              id="priority-medium" 
              name="priority" 
              value="medium" 
              v-model="todo.priority"
              class="priority-radio"
            >
            <label for="priority-medium" class="priority-label">Moyenne</label>
          </div>
          <div class="priority-option high">
            <input 
              type="radio" 
              id="priority-high" 
              name="priority" 
              value="high" 
              v-model="todo.priority"
              class="priority-radio"
            >
            <label for="priority-high" class="priority-label">Haute</label>
          </div>
        </div>
      </div>
      
      <!-- Section de notification par email -->
      <div class="form-group notification-section">
        <div class="notification-header">
          <label class="form-label">Notification par email</label>
          <div class="toggle-container">
            <input 
              type="checkbox" 
              id="notifications-toggle" 
              v-model="todo.notificationsEnabled"
              class="toggle-checkbox"
            >
            <label for="notifications-toggle" class="toggle-label"></label>
          </div>
        </div>
        
        <div v-if="todo.notificationsEnabled" class="notification-details">
          <div class="form-group">
            <label for="notification-email" class="form-label">Adresse email</label>
            <input 
              id="notification-email"
              v-model="todo.notificationEmail"
              type="email"
              placeholder="Votre adresse email"
              class="form-control"
              required
            >
          </div>
          <p class="notification-info">
            <i class="notification-icon">ℹ️</i>
            Vous recevrez un email 1 heure avant l'échéance de cette tâche.
          </p>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="button" @click="$emit('cancel')" class="cancel-btn">Annuler</button>
        <button type="submit" class="submit-btn">
          Ajouter la tâche
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useStore } from 'vuex'

export default {
  name: 'TodoForm',
  setup() {
    const store = useStore()
    const hours = ref('12')
    const minutes = ref('00')
    
    const todo = ref({
      title: '',
      description: '',
      dueDate: new Date().toISOString().split('T')[0],
      category: 'autre',
      priority: 'medium',
      completed: false,
      notificationsEnabled: false,
      notificationEmail: ''
    })

    const submitForm = async () => {
      // Combine hours and minutes into dueTime
      const todoData = { 
        ...todo.value,
        dueTime: `${hours.value}:${minutes.value}`
      }
      
      const result = await store.dispatch('createTodo', todoData)
      
      if (result.success) {
        // Reset form
        todo.value = {
          title: '',
          description: '',
          dueDate: new Date().toISOString().split('T')[0],
          category: 'autre',
          priority: 'medium',
          completed: false,
          notificationsEnabled: false,
          notificationEmail: ''
        }
        hours.value = '12'
        minutes.value = '00'
      }
    }

    return {
      todo,
      hours,
      minutes,
      submitForm
    }
  }
}
</script>

<style scoped>
.todo-form {
  background-color: var(--overlay-light);
  padding: 1.5rem;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.form-title {
  margin-bottom: 1.5rem;
  color: var(--dark);
  font-weight: 600;
  text-align: center;
  font-size: 1.5rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--dark);
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--gray-light);
  border-radius: var(--border-radius);
  font-size: 1rem;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.9);
}

.form-control:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(74, 124, 89, 0.2);
  outline: none;
}

.form-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.form-col {
  flex: 1;
}

.form-actions {
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
  font-weight: 500;
}

.cancel-btn:hover {
  background-color: var(--gray);
  color: white;
  transform: translateY(-2px);
}

.submit-btn {
  padding: 0.75rem 1.5rem;
  background-color: var(--primary);
  color: white;
  border-radius: var(--border-radius);
  transition: var(--transition);
  font-weight: 500;
}

.submit-btn:hover {
  background-color: var(--secondary);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.error-message {
  color: var(--danger);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

/* Styles pour les options de priorité */
.priority-options {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.priority-option {
  flex: 1;
  position: relative;
}

.priority-radio {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.priority-label {
  display: block;
  padding: 0.5rem;
  text-align: center;
  border: 2px solid var(--gray-light);
  border-radius: var(--border-radius);
  cursor: pointer;
  transition: var(--transition);
  font-size: 0.9rem;
  background-color: rgba(255, 255, 255, 0.7);
}

.priority-radio:checked + .priority-label {
  border-color: transparent;
  color: white;
  font-weight: 500;
}

.priority-option.low .priority-radio:checked + .priority-label {
  background-color: var(--success);
}

.priority-option.medium .priority-radio:checked + .priority-label {
  background-color: var(--warning);
}

.priority-option.high .priority-radio:checked + .priority-label {
  background-color: var(--danger);
}

.priority-option.low .priority-label:hover {
  border-color: var(--success);
}

.priority-option.medium .priority-label:hover {
  border-color: var(--warning);
}

.priority-option.high .priority-label:hover {
  border-color: var(--danger);
}

/* Responsive */
@media (max-width: 768px) {
  .form-row {
    flex-direction: column;
    gap: 1rem;
  }
  
  .form-actions {
    flex-direction: column-reverse;
  }
  
  .submit-btn, .cancel-btn {
    width: 100%;
  }
}

.notification-section {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius);
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.notification-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.notification-details {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.notification-info {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--dark);
  margin-top: 0.5rem;
  background-color: rgba(255, 255, 255, 0.5);
  padding: 0.75rem;
  border-radius: var(--border-radius);
}

.notification-icon {
  font-style: normal;
}
</style>
