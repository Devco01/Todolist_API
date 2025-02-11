<template>
  <div class="todo-item" :class="{ completed: todo.completed }">
    <input 
      type="checkbox"
      :checked="todo.completed"
      @change="toggleComplete"
    >
    <div class="todo-content">
      <h3>{{ todo.title }}</h3>
      <div class="todo-meta">
        <span class="category">{{ todo.category }}</span>
        <span v-if="todo.dueDate" class="due-date">
          Pour le: {{ formatDate(todo.dueDate) }}
        </span>
      </div>
    </div>
    <button @click="$emit('delete')" class="delete-btn">
      Supprimer
    </button>
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
  setup(props) {
    const store = useStore()

    const toggleComplete = () => {
      store.dispatch('updateTodo', {
        ...props.todo,
        completed: !props.todo.completed
      })
    }

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('fr-FR')
    }

    return {
      toggleComplete,
      formatDate
    }
  }
}
</script>

<style scoped>
.todo-item {
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.todo-content {
  flex: 1;
  margin: 0 10px;
}

.completed {
  opacity: 0.7;
}

.completed h3 {
  text-decoration: line-through;
}

.todo-meta {
  font-size: 0.9em;
  color: #666;
}

.category {
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 8px;
}

.delete-btn {
  padding: 4px 8px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.delete-btn:hover {
  background: #cc0000;
}
</style>
