<template>
  <div class="app-container">
    <NavBar />
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
import NavBar from './components/NavBar.vue';

export default {
  components: {
    NavBar
  },
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
    
    // Fonction spéciale pour forcer la sauvegarde des tâches existantes
    const forceSaveTodos = () => {
      const todos = store.state.todos;
      if (Array.isArray(todos) && todos.length > 0) {
        console.log('[DEBUG] Force sauvegarde des tâches existantes:', todos.length);
        
        // Sauvegarder directement dans localStorage
        try {
          const jsonData = JSON.stringify(todos);
          localStorage.setItem('todos', jsonData);
          console.log('[DEBUG] Force sauvegarde réussie');
          
          // Vérifier
          const saved = localStorage.getItem('todos');
          console.log('[DEBUG] Vérification après force sauvegarde:', 
            saved ? `${saved.length} caractères` : 'Échec');
        } catch (e) {
          console.error('[DEBUG] Erreur lors de la force sauvegarde:', e);
        }
      }
    };
    
    // Charger les tâches au démarrage de l'application
    onMounted(async () => {
      console.log('[DEBUG] Application démarrée - Initialisation...');
      
      // Vérifier l'authentification de l'utilisateur
      try {
        await store.dispatch('checkAuth');
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la vérification de l\'authentification:', error);
      }
      
      // Continuer avec le chargement des tâches (seulement si l'utilisateur est authentifié)
      if (store.state.isAuthenticated) {
        console.log('[DEBUG] Utilisateur authentifié - Chargement des tâches...');
        
        // *** CORRECTIF CRITIQUE: CHARGEMENT IMMÉDIAT DEPUIS LOCALSTORAGE ***
        try {
          const rawData = localStorage.getItem('todos');
          if (rawData && rawData.length > 2) {
            console.log(`[DEBUG] Données trouvées dans localStorage au démarrage (${rawData.length} caractères)`);
            
            try {
              const parsedTodos = JSON.parse(rawData);
              if (Array.isArray(parsedTodos) && parsedTodos.length > 0) {
                console.log(`[DEBUG] CHARGEMENT CRITIQUE: ${parsedTodos.length} tâches trouvées dans localStorage`);
                // Charger immédiatement les tâches du localStorage pour affichage instantané
                store.commit('SET_TODOS', parsedTodos);
              }
            } catch (parseError) {
              console.error('[DEBUG] Erreur de parsing du localStorage:', parseError);
            }
          }
        } catch (localStorageError) {
          console.error('[DEBUG] Erreur d\'accès au localStorage:', localStorageError);
        }
      } else {
        // Si l'utilisateur n'est pas authentifié, nettoyer complètement le localStorage des tâches
        console.log('[DEBUG] Utilisateur non authentifié - Nettoyage du localStorage');
        localStorage.removeItem('todos');
        store.commit('SET_TODOS', []);
        
        // Redirection vers la page de connexion si nécessaire
        if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          console.log('[DEBUG] Utilisateur non authentifié - Redirection vers la page de connexion');
          if (window.location) {
            window.location.href = '/login';
          }
        }
        
        return; // Sortir de la fonction pour ne pas charger les tâches
      }
      
      // *** VÉRIFICATION SPÉCIALE DE LA SANTÉ DU LOCALSTORAGE ***
      let localStorageWorking = true;
      try {
        localStorage.setItem('test_health', 'ok');
        const test = localStorage.getItem('test_health');
        if (test !== 'ok') {
          console.error('[DEBUG] Test de santé du localStorage échoué');
          localStorageWorking = false;
        } else {
          localStorage.removeItem('test_health');
        }
      } catch (e) {
        console.error('[DEBUG] Exception lors du test de santé du localStorage:', e);
        localStorageWorking = false;
      }
      
      // Récupérer d'abord les tâches du localStorage
      let localTodos = null;
      if (localStorageWorking) {
        try {
          const rawData = localStorage.getItem('todos');
          console.log('[DEBUG] Tâches trouvées dans localStorage au démarrage:', 
            rawData ? `Oui (${rawData.length} caractères)` : 'Non');
          
          if (rawData && rawData.length > 2) { // Plus que juste "[]"
            localTodos = JSON.parse(rawData);
            
            // Force sauvegarder dans le store si des tâches existent localement
            // pour éviter de les perdre en cas d'échec de la récupération serveur
            if (Array.isArray(localTodos) && localTodos.length > 0) {
              console.log('[DEBUG] Sauvegarde préventive des tâches locales:', localTodos.length);
              store.commit('SET_TODOS', localTodos);
            }
          }
        } catch (e) {
          console.error('[DEBUG] Erreur lors de la récupération directe depuis localStorage:', e);
        }
      }
      
      // *** CORRECTIF CRITIQUE: MULTI-TENTATIVE DE RÉCUPÉRATION SERVEUR ***
      // Fonction pour tenter de récupérer les données du serveur avec plusieurs essais
      const fetchWithRetry = async (retries = 2, delay = 1000) => {
        let lastError = null;
        
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) {
              console.log(`[DEBUG] Tentative de récupération #${attempt}...`);
            }
            
            // Essayer de récupérer les données depuis le serveur
            const result = await store.dispatch('fetchTodos');
            console.log('[DEBUG] Résultat de la récupération des tâches:', result);
            
            // Si réussi, sortir de la boucle
            return result;
          } catch (error) {
            lastError = error;
            console.error(`[DEBUG] Échec de la tentative #${attempt}:`, error);
            
            if (attempt < retries) {
              console.log(`[DEBUG] Nouvelle tentative dans ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        // Si toutes les tentatives ont échoué
        throw lastError || new Error('Échec des tentatives de récupération');
      };
      
      try {
        // Essayer de récupérer les données avec retry
        const result = await fetchWithRetry();
        
        // Vérifier le chargement
        const todosCount = store.state.todos.length;
        console.log(`[DEBUG] Nombre de tâches après chargement: ${todosCount}`);
        
        // Si aucune tâche n'a été chargée mais qu'il y en a dans localStorage, charger celles-ci
        if (todosCount === 0 && localTodos && Array.isArray(localTodos) && localTodos.length > 0) {
          console.log('[DEBUG] Aucune tâche chargée depuis le serveur mais présentes en local, chargement de secours...');
          store.commit('SET_TODOS', localTodos);
        }
        
        // Force sauvegarder après tout le processus pour s'assurer que les données sont persistées
        window.setTimeout(forceSaveTodos, 500);
        
        // Configurer la synchronisation périodique (toutes les 5 minutes)
        syncInterval = setInterval(syncTodos, 5 * 60 * 1000);
        
        // Ajout d'une sauvegarde périodique toutes les 30 secondes
        const saveInterval = setInterval(forceSaveTodos, 30 * 1000);
        
        // Ajouter un écouteur d'événement pour détecter la reprise après veille
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Ajouter un gestionnaire d'événements pour l'état de connexion
        window.addEventListener('online', () => {
          console.log('[DEBUG] Connexion internet rétablie - Synchronisation des tâches');
          syncTodos();
        });
        
        // Sauvegarder avant fermeture de la page
        window.addEventListener('beforeunload', () => {
          console.log('[DEBUG] Page en cours de fermeture - Sauvegarde des tâches');
          forceSaveTodos();
        });
      } catch (error) {
        console.error('[DEBUG] Erreur lors du chargement initial des tâches:', error);
        
        // Vérifier l'état actuel des todos
        const todosCount = store.state.todos.length;
        console.log(`[DEBUG] État des todos après erreur: ${todosCount} tâches`);
        
        // En cas d'échec complet, utiliser le chargement d'urgence depuis localStorage
        if (todosCount === 0 && localTodos && Array.isArray(localTodos) && localTodos.length > 0) {
          console.log('[DEBUG] Chargement de secours après échec complet...');
          store.commit('SET_TODOS', localTodos);
        }
        
        // Force sauvegarder même en cas d'erreur
        window.setTimeout(forceSaveTodos, 500);
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