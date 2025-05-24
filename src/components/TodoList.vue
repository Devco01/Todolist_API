<template>
  <div class="todo-container">
    <div class="header-actions">
      <h1>{{ isAuthenticated ? `Tâches de ${userName}` : 'Mes tâches' }}</h1>
      
      <div class="status-indicators">
        <span v-if="isOfflineMode" class="offline-indicator">
          Mode hors ligne
        </span>
        <span v-if="isAuthenticated" class="user-indicator">
          {{ isOfflineMode ? 'Connexion perdue' : 'Connecté' }}
        </span>
      </div>
    </div>
    
    <!-- ... existing code ... -->
  </div>
</template>

<script>
// ... existing imports and code ...

export default {
  // ... existing component code ...
  
  data() {
    return {
      // ... existing data properties ...
    }
  },
  
  methods: {
    // ... existing methods ...
  }
}
</script>

<style>
/* ... existing styles ... */

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
  gap: 10px;
}

@media (min-width: 768px) {
  .header-actions {
    flex-direction: row;
    justify-content: space-between;
  }
}
</style> 