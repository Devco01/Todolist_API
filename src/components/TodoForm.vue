<template>
  <form @submit.prevent="submitForm" class="todo-form">
    <input 
      v-model="todo.title"
      type="text"
      placeholder="Nouvelle tâche..."
      required
    >
    <div class="form-row">
      <input 
        v-model="todo.dueDate"
        type="date"
      >
      <select v-model="todo.category">
        <option value="maison">Maison</option>
        <option value="courses">Courses</option>
        <option value="santé">Santé</option>
        <option value="famille">Famille</option>
        <option value="autre">Autre</option>
      </select>
    </div>
    <button type="submit">Ajouter</button>
  </form>
</template>

<script>
import { ref } from 'vue'
import { useStore } from 'vuex'

export default {
  name: 'TodoForm',
  setup() {
    const store = useStore()
    const todo = ref({
      title: '',
      dueDate: new Date().toISOString().split('T')[0],
      category: 'autre'
    })

    const submitForm = async () => {
      await store.dispatch('createTodo', todo.value)
      todo.value = {
        title: '',
        dueDate: new Date().toISOString().split('T')[0],
        category: 'autre'
      }
    }

    return {
      todo,
      submitForm
    }
  }
}
</script>

<style scoped>
.todo-form {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row {
  display: flex;
  gap: 10px;
}

input, select {
  padding: 8px;
  border: 1px solid #4169e1;
  border-radius: 4px;
}

button {
  padding: 8px;
  background: #4169e1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #1e90ff;
}
</style>
