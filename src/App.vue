<template>
  <div class="app-container">
    <div class="bg-image"></div>
    <div class="content-wrapper">
      <router-view></router-view>
    </div>
    
    <!-- Notification globale -->
    <transition name="slide">
      <div v-if="notificationStatus" 
           class="global-notification" 
           :class="{ success: notificationStatus.success, error: !notificationStatus.success }">
        <span class="notification-icon">{{ notificationStatus.success ? '✓' : '✗' }}</span>
        {{ notificationStatus.message }}
      </div>
    </transition>
  </div>
</template>

<script>
import { computed, watchEffect, onMounted, onUnmounted } from 'vue';
import { useStore } from 'vuex';

export default {
  setup() {
    const store = useStore();
    
    const notificationStatus = computed(() => store.state.notificationStatus);
    
    // Cacher automatiquement la notification après 3 secondes
    let notificationTimeout = null;
    let syncInterval = null;
    
    const clearNotification = () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
      
      if (notificationStatus.value) {
        notificationTimeout = setTimeout(() => {
          store.commit('SET_NOTIFICATION_STATUS', null);
        }, 3000);
      }
    };
    
    // Observer les changements de statut de notification
    watchEffect(() => {
      if (notificationStatus.value) {
        clearNotification();
      }
    });
    
    // Fonction de synchronisation des tâches
    const syncTodos = async () => {
      try {
        console.log('Synchronisation périodique des tâches...');
        await store.dispatch('fetchTodos');
      } catch (error) {
        console.error('Erreur lors de la synchronisation périodique:', error);
      }
    };
    
    // Gestionnaire d'événement pour la reprise d'activité après veille
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Application de nouveau visible - Synchronisation des tâches');
        syncTodos();
      }
    };
    
    // Charger les tâches au démarrage de l'application
    onMounted(async () => {
      console.log('[DEBUG] Application démarrée - Chargement initial des tâches...');
      
      // Récupérer d'abord les tâches du localStorage
      const localTodos = localStorage.getItem('todos');
      console.log('[DEBUG] Tâches trouvées dans localStorage au démarrage:', localTodos ? 'Oui' : 'Non');
      
      try {
        // Essayer de récupérer les données depuis le serveur
        console.log('[DEBUG] Tentative de récupération des tâches depuis le serveur...');
        const result = await store.dispatch('fetchTodos');
        console.log('[DEBUG] Résultat de la récupération des tâches:', result);
        
        // Vérifier le chargement
        const todosCount = store.state.todos.length;
        console.log(`[DEBUG] Nombre de tâches après chargement: ${todosCount}`);
        
        // Si aucune tâche n'a été chargée mais qu'il y en a dans localStorage, charger celles-ci
        if (todosCount === 0 && localTodos && localTodos.length > 0) {
          console.log('[DEBUG] Aucune tâche chargée depuis le serveur mais présentes en local, chargement de secours...');
          await store.dispatch('loadFromLocalStorageOnly');
        }
        
        // Configurer la synchronisation périodique (toutes les 5 minutes)
        syncInterval = setInterval(syncTodos, 5 * 60 * 1000);
        
        // Ajouter un écouteur d'événement pour détecter la reprise après veille
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Ajouter un gestionnaire d'événements pour l'état de connexion
        window.addEventListener('online', () => {
          console.log('[DEBUG] Connexion internet rétablie - Synchronisation des tâches');
          syncTodos();
        });
      } catch (error) {
        console.error('[DEBUG] Erreur lors du chargement initial des tâches:', error);
        
        // Vérifier l'état actuel des todos
        const todosCount = store.state.todos.length;
        console.log(`[DEBUG] État des todos après erreur: ${todosCount} tâches`);
        
        // En cas d'échec complet, utiliser le chargement d'urgence depuis localStorage
        if (todosCount === 0 && localTodos && localTodos.length > 0) {
          console.log('[DEBUG] Chargement de secours après échec complet...');
          await store.dispatch('loadFromLocalStorageOnly');
        }
      }
    });
    
    // Nettoyage des écouteurs d'événements et des intervalles
    const cleanup = () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    
    // Nettoyer les ressources lors de la destruction du composant
    onUnmounted(cleanup);
    
    return {
      notificationStatus
    };
  }
}
</script>

<style>
/* Import de polices Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

/* Styles globaux */
:root {
  --primary: #4a7c59;
  --primary-light: #6a9e78;
  --secondary: #2c5530;
  --accent: #d4a373;
  --success: #588157;
  --warning: #d9a557;
  --danger: #bc4749;
  --light: #f8f9fa;
  --dark: #1b2e1e;
  --gray: #6c757d;
  --gray-light: #e9ecef;
  --border-radius: 8px;
  --box-shadow: 0 4px 6px rgba(0, 0, 0, 0.2);
  --transition: all 0.3s ease;
  --overlay-light: rgba(255, 255, 255, 0.85);
  --overlay-dark: rgba(27, 46, 30, 0.7);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family: 'Poppins', 'Inter', 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--dark);
  line-height: 1.6;
  background-color: #1b2e1e;
}

.app-container {
  min-height: 100vh;
  height: fit-content;
  padding: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url('/images/mushishi_wallpaper.jpeg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: -1;
  opacity: 0.9;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  z-index: 1;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--dark);
}

button {
  cursor: pointer;
  border: none;
  border-radius: var(--border-radius);
  padding: 0.5rem 1rem;
  font-weight: 500;
  transition: var(--transition);
}

input, select, textarea {
  border: 1px solid var(--gray-light);
  border-radius: var(--border-radius);
  padding: 0.5rem;
  font-size: 1rem;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.9);
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(74, 124, 89, 0.2);
}

/* Notification globale */
.global-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 20px;
  color: white;
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  animation: slide-in 0.3s ease-out forwards;
  font-weight: 500;
}

.global-notification.success {
  background-color: var(--success);
}

.global-notification.error {
  background-color: var(--danger);
}

.notification-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.slide-enter-active {
  animation: slide-in 0.3s ease-out forwards;
}

.slide-leave-active {
  animation: slide-out 0.3s ease-in forwards;
}

@keyframes slide-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

/* Personnalisation de la barre de défilement */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: var(--gray-light);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: var(--primary-light);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--primary);
}
</style> 