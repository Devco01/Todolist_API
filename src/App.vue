<template>
  <div class="app-container">
    <!-- Composant d'alerte pour les problèmes de stockage mobile -->
    <MobileStorageAlert />
    
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
import MobileStorageAlert from './components/MobileStorageAlert.vue';
import axios from './utils/axios';
import { mapState, mapMutations, mapActions } from 'vuex';

export default {
  components: {
    NavBar,
    MobileStorageAlert
  },
  setup() {
    const store = useStore();
    
    const notificationStatus = computed(() => store.state.notificationStatus);
    
    // Cacher automatiquement la notification après 3 secondes
    let notificationTimeout = null;
    let syncInterval = null;
    let emergencySyncInProgress = false;
    
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
        
        // Tenter d'abord une synchronisation d'urgence (push des modifications locales)
        await emergencySync();
        
        // Puis récupérer les tâches du serveur (pull des modifications distantes)
        await store.dispatch('fetchTodos');
      } catch (error) {
        console.error('Erreur lors de la synchronisation périodique:', error);
      }
    };
    
    // Nouvelle fonction de synchronisation d'urgence qui évite l'erreur 405
    const emergencySync = async () => {
      if (store.state.emergencySyncInProgress) {
        console.log('[DEBUG] Synchronisation d\'urgence déjà en cours, ignorée');
        return;
      }
      
      store.commit('SET_EMERGENCY_SYNC_IN_PROGRESS', true);
      console.log('[DEBUG] Synchronisation d\'urgence de', store.state.todos.length, 'tâches...');
      
      // Récupérer les tâches du store
      const todos = [...store.state.todos];
      let successCount = 0;
      let errorCount = 0;
      
      for (const todo of todos) {
        try {
          const todoId = todo.id || todo._id;
          
          if (!todoId) {
            console.log('[DEBUG] Tâche sans ID, impossible de la synchroniser:', todo);
            errorCount++;
            continue;
          }
          
          console.log('[DEBUG] Mise à jour d\'urgence de la tâche', todoId);
          
          // Utiliser PUT pour les tâches existantes
          const todoWithId = { ...todo };
          if (!todoWithId._id) todoWithId._id = todoId;
          if (!todoWithId.id) todoWithId.id = todoId;
          
          // S'assurer que nous avons userId
          if (store.state.user && store.state.user.id && !todoWithId.userId) {
            todoWithId.userId = store.state.user.id;
          }
          
          const response = await axios.put(`/todos/${todoId}`, todoWithId);
          
          if (response.data) {
            console.log('[DEBUG] Synchronisation d\'urgence réussie pour la tâche', todoId);
            successCount++;
          }
        } catch (error) {
          console.error('[DEBUG] Erreur lors de la sauvegarde d\'urgence:', error);
          errorCount++;
        }
      }
      
      console.log(`[DEBUG] Synchronisation d'urgence terminée: ${successCount} réussies, ${errorCount} échouées`);
      store.commit('SET_EMERGENCY_SYNC_IN_PROGRESS', false);
    };
    
    // Gestionnaire d'événement pour la reprise d'activité après veille
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Application de nouveau visible - Synchronisation des tâches');
        
        // NOUVEAU: Gestion spéciale pour mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
          console.log('[MOBILE] Retour d\'arrière-plan détecté - Synchronisation prioritaire');
          
          // Forcer le chargement immédiat depuis le stockage local pour affichage rapide
          const todos = store.state.todos;
          if (!todos || todos.length === 0) {
            console.log('[MOBILE] Chargement d\'urgence depuis le stockage local...');
            store.dispatch('loadFromLocalStorageOnly');
          }
          
          // Puis synchroniser avec le serveur
          setTimeout(() => {
            syncTodos();
          }, 500);
        } else {
          syncTodos();
        }
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
    
    // Fonction pour récupérer l'utilisateur si les informations sont perdues
    const recoverUserIfNeeded = async () => {
      try {
        // Vérifier si nous avons un token mais pas d'utilisateur
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');
        
        console.log('[DEBUG] Vérification de la session existante -', 
          'Token:', token ? 'Présent' : 'Absent', 
          'User:', user ? 'Présent' : 'Absent');
        
        // Si nous avons un token, essayer de restaurer la session même si l'utilisateur est présent
        // (pour être sûr que l'authentification est valide)
        if (token) {
          console.log('[DEBUG] Token trouvé, tentative de récupération de la session');
          
          // Forcer le token dans les headers avant l'appel
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          // Tentative de récupération des informations utilisateur avec intercepteur spécial pour token
          try {
            const response = await axios.get('/auth/me', {
              transformResponse: [data => {
                try {
                  return JSON.parse(data);
                } catch (error) {
                  console.error('[DEBUG] Erreur de parsing JSON dans transformResponse:', error);
                  return { error: 'Réponse invalide' };
                }
              }],
              validateStatus: status => status < 500 // Accepter les codes 2xx-4xx
            });
            
            // Vérifier si un nouveau token a été fourni dans l'en-tête
            const newToken = response.headers['x-auth-token'];
            if (newToken) {
              console.log('[DEBUG] Nouveau token reçu, mise à jour du localStorage');
              localStorage.setItem('authToken', newToken);
              axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            }
            
            if (response.status === 200 && response.data.success && response.data.user) {
              console.log('[DEBUG] Session récupérée avec succès, mise à jour de l\'utilisateur');
              store.commit('SET_USER', response.data.user);
              store.commit('SET_AUTHENTICATED', true);
              
              // Sauvegarder l'utilisateur dans localStorage également
              localStorage.setItem('user', JSON.stringify(response.data.user));
              
              // Session est valide, continuer
              console.log('[DEBUG] Récupération session réussie ✓');
              
              // Vérification proactive des données dans localStorage
              const todosData = localStorage.getItem('todos');
              console.log('[DEBUG] Données trouvées dans localStorage au démarrage', todosData ? `(${todosData.length} caractères)` : '(aucune)');
              
              if (todosData && todosData.length > 10) {
                const parsedTodos = JSON.parse(todosData);
                console.log('[DEBUG] CHARGEMENT CRITIQUE:', parsedTodos.length, 'tâches trouvées dans localStorage');
                store.commit('SET_TODOS', parsedTodos);
              }
              
              // Exécuter la synchronisation d'urgence après un court délai
              setTimeout(() => {
                if (store.state.todos.length > 0) {
                  console.log('[DEBUG] Synchronisation d\'urgence de', store.state.todos.length, 'tâches...');
                  emergencySync();
                }
              }, 3000);
              
              return true;
            } else {
              console.log('[DEBUG] Échec de la récupération de session, réponse invalide:', response.status);
              return false;
            }
          } catch (error) {
            console.error('[DEBUG] Erreur lors de la récupération de la session:', error);
            
            // Si l'erreur indique une expiration de session mais qu'il s'agit d'une route sécurisée,
            // ne pas déconnecter pour éviter la perte de données
            if (error.response && error.response.status === 401) {
              console.warn('[DEBUG] Session expirée ou token invalide');
              // Ne pas effacer les données tout de suite
            } else {
              console.error('[DEBUG] Autre type d\'erreur lors de la récupération:', error);
            }
            
            // Si c'est une erreur de parsing JSON, essayons de forcer un ping
            if (error.name === 'SyntaxError' && error.message.includes('JSON.parse')) {
              console.log('[DEBUG] Erreur de parsing JSON détectée, tentative de ping');
              
              // Envoi d'un ping pour vérifier si le serveur est disponible
              try {
                console.log('[DEBUG] Envoi d\'un ping pour maintenir la session active...');
                await axios.get('/keep-alive');
                console.log('[DEBUG] Ping réussi, session maintenue active');
                
                // Si le ping réussit, tenter de charger les tâches quand même
                const todoResult = await store.dispatch('fetchTodos');
                console.log('[DEBUG] Résultat de la récupération des tâches après ping:', todoResult);
              } catch (pingError) {
                console.error('[DEBUG] Erreur lors du ping:', pingError);
              }
            }
            
            return false;
          }
        }
        
        return false;
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la tentative de récupération utilisateur:', error);
        return false;
      }
    };
    
    // Fonction pour envoyer un ping au serveur et maintenir la session
    const pingServer = async () => {
      try {
        console.log('[DEBUG] Envoi d\'un ping pour maintenir la session active...');
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          console.log('[DEBUG] Pas de token, ping annulé');
          return false;
        }
        
        // Utiliser un endpoint plus simple pour le ping
        try {
          // Essayer d'abord avec /auth/me qui est plus fiable
          const response = await axios.get('/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            timeout: 5000 // Timeout de 5 secondes pour éviter de bloquer
          });
          
          console.log('[DEBUG] Ping réussi via /auth/me');
          
          // Vérifier si un nouveau token est fourni 
          const newToken = response.headers['x-auth-token'];
          if (newToken && newToken !== token) {
            console.log('[DEBUG] Nouveau token reçu dans le ping, mise à jour');
            localStorage.setItem('authToken', newToken);
            axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          }
          
          return true;
        } catch (authError) {
          console.warn('[DEBUG] Erreur lors du ping sur /auth/me:', authError.message);
          
          // Fallback vers un endpoint plus simple si /auth/me échoue
          try {
            const fallbackResponse = await axios.get('/keep-alive', {
              timeout: 3000
            });
            
            console.log('[DEBUG] Ping de secours réussi via /keep-alive');
            return true;
          } catch (fallbackError) {
            console.error('[DEBUG] Échec du ping de secours:', fallbackError.message);
            
            // Si l'erreur est 401, la session a expiré
            if (fallbackError.response && fallbackError.response.status === 401) {
              console.warn('[DEBUG] Session expirée détectée lors du ping');
              // Tenter de récupérer la session
              const recovered = await recoverUserIfNeeded();
              return recovered;
            }
            
            return false;
          }
        }
      } catch (error) {
        console.error('[DEBUG] Erreur générale lors du ping:', error);
        return false;
      }
    };
    
    // Fonction spéciale pour rechercher et restaurer les sauvegardes après déconnexion
    const checkForLogoutBackups = async () => {
      // Chercher les sauvegardes de déconnexion
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('todos_logout_backup_')) {
          backupKeys.push(key);
        }
      }
      
      if (backupKeys.length === 0) {
        console.log('[DEBUG] Aucune sauvegarde de déconnexion trouvée');
        return false;
      }
      
      // Trier pour avoir la plus récente
      backupKeys.sort();
      const latestBackup = backupKeys[backupKeys.length - 1];
      console.log(`[DEBUG] Sauvegarde de déconnexion trouvée: ${latestBackup}`);
      
      // Tenter de charger cette sauvegarde
      try {
        const backupData = localStorage.getItem(latestBackup);
        if (!backupData || backupData.length <= 2) {
          console.log('[DEBUG] Sauvegarde de déconnexion vide ou invalide');
          return false;
        }
        
        const backupTodos = JSON.parse(backupData);
        if (!Array.isArray(backupTodos) || backupTodos.length === 0) {
          console.log('[DEBUG] Sauvegarde de déconnexion ne contient pas de tâches valides');
          return false;
        }
        
        console.log(`[DEBUG] Sauvegarde de déconnexion contient ${backupTodos.length} tâches`);
        
        // Vérifier si les todos actuels sont vides (nouvelle connexion)
        const currentTodos = store.state.todos;
        if (Array.isArray(currentTodos) && currentTodos.length > 0) {
          console.log('[DEBUG] Des tâches sont déjà présentes, pas besoin de restaurer');
          return false;
        }
        
        // Vérifier si l'utilisateur correspondant est le même
        const currentUser = store.state.user;
        if (!currentUser || !currentUser.id) {
          console.log('[DEBUG] Pas d\'utilisateur connecté, restauration impossible');
          return false;
        }
        
        // Vérifier que les tâches appartiennent à l'utilisateur actuel
        const userTodos = backupTodos.filter(todo => 
          !todo.userId || todo.userId === currentUser.id
        );
        
        if (userTodos.length === 0) {
          console.log('[DEBUG] Aucune tâche correspondant à l\'utilisateur actuel dans la sauvegarde');
          return false;
        }
        
        console.log(`[DEBUG] ${userTodos.length} tâches correspondant à l'utilisateur actuel trouvées dans la sauvegarde`);
        
        // Demander à l'utilisateur s'il souhaite restaurer ses tâches
        store.commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: `Vos ${userTodos.length} tâches précédentes ont été retrouvées. Restauration en cours...`
        });
        
        // Restaurer les tâches
        store.commit('SET_TODOS', userTodos);
        
        // Sauvegarder dans le localStorage
        localStorage.setItem('todos', JSON.stringify(userTodos));
        
        // Supprimer cette sauvegarde après restauration
        localStorage.removeItem(latestBackup);
        
        return true;
      } catch (e) {
        console.error('[DEBUG] Erreur lors de la restauration de la sauvegarde:', e);
        return false;
      }
    };
    
    // Charger les tâches au démarrage de l'application
    onMounted(async () => {
      console.log('[DEBUG] Application démarrée - Initialisation...');
      
      // Marquer l'application comme initialisée
      sessionStorage.setItem('appInitialized', 'true');
      
      // Supprimer toute notification existante au démarrage
      store.commit('SET_NOTIFICATION_STATUS', null);
      
      // Vérifier l'authentification de l'utilisateur
      try {
        await store.dispatch('checkAuth');
        console.log('[DEBUG] Vérification d\'authentification terminée');
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la vérification de l\'authentification:', error);
      }
      
      // NOUVELLE STRATÉGIE: Utiliser la synchronisation automatique
      try {
        console.log('[DEBUG] Démarrage de la synchronisation automatique...');
        const result = await store.dispatch('autoSyncOnStartup');
        console.log('[DEBUG] Résultat de la synchronisation automatique:', result);
        
        if (result.success) {
          console.log('[DEBUG] Synchronisation automatique réussie:', result.message);
        } else {
          console.error('[DEBUG] Échec de la synchronisation automatique:', result.error);
        }
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la synchronisation automatique:', error);
      }
      
      // Sync périodique (15 min uniquement si l'onglet est visible — limite le compute Neon)
      const SYNC_MS = 15 * 60 * 1000;
      syncInterval = setInterval(async () => {
        if (document.visibilityState !== 'visible') {
          return;
        }
        console.log('[DEBUG] Synchronisation périodique...');
        try {
          await store.dispatch('fetchTodos');
        } catch (error) {
          console.error('[DEBUG] Erreur lors de la synchronisation périodique:', error);
        }
      }, SYNC_MS);
      
      // Ajouter un écouteur d'événements pour détecter la reprise après veille
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Gestionnaire pour l'état de connexion
      window.addEventListener('online', () => {
        console.log('[DEBUG] Connexion internet rétablie - Synchronisation des tâches');
        store.dispatch('fetchTodos');
      });
      
      // Sauvegarder avant fermeture de la page
      window.addEventListener('beforeunload', async (event) => {
        console.log('[DEBUG] Page en cours de fermeture - Sauvegarde des tâches');
        forceSaveTodos();
      });
      
      // Nettoyer les intervalles lors de la destruction
      onUnmounted(() => {
        if (syncInterval) {
          clearInterval(syncInterval);
        }
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      });
    });
    
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

/* Styles responsives globaux */
@media (max-width: 768px) {
  body {
    font-size: 16px; /* Évite le zoom automatique sur iOS */
    line-height: 1.5;
  }
  
  .app-container {
    min-height: 100vh;
    height: auto;
  }
  
  .content-wrapper {
    padding: 0;
  }
  
  /* Amélioration de la typographie mobile */
  h1 {
    font-size: 1.5rem;
    line-height: 1.3;
  }
  
  h2 {
    font-size: 1.25rem;
    line-height: 1.3;
  }
  
  h3 {
    font-size: 1.125rem;
    line-height: 1.3;
  }
  
  /* Optimisation des formulaires */
  input, select, textarea {
    font-size: 16px; /* Évite le zoom sur iOS */
    padding: 0.75rem;
    border-radius: 8px;
    touch-action: manipulation;
  }
  
  button {
    min-height: 44px; /* Taille tactile recommandée */
    padding: 0.75rem 1rem;
    font-size: 1rem;
    border-radius: 8px;
    touch-action: manipulation;
  }
  
  /* Amélioration des notifications */
  .global-notification {
    bottom: 10px;
    right: 10px;
    left: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
  }
}

/* Styles pour très petits écrans */
@media (max-width: 480px) {
  body {
    font-size: 16px;
    line-height: 1.4;
  }
  
  .bg-image {
    background-size: cover;
    background-position: center center;
    background-attachment: scroll; /* Évite les problèmes sur mobile */
  }
  
  /* Typographie optimisée */
  h1 {
    font-size: 1.25rem;
    line-height: 1.25;
    margin-bottom: 0.75rem;
  }
  
  h2 {
    font-size: 1.125rem;
    line-height: 1.25;
    margin-bottom: 0.75rem;
  }
  
  h3 {
    font-size: 1rem;
    line-height: 1.25;
    margin-bottom: 0.5rem;
  }
  
  /* Formulaires optimisés */
  input, select, textarea {
    padding: 0.875rem;
    font-size: 16px;
    border-radius: 8px;
    border-width: 2px;
    line-height: 1.3;
  }
  
  input:focus, select:focus, textarea:focus {
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.15);
    border-color: var(--primary);
  }
  
  button {
    min-height: 48px;
    padding: 0.875rem 1.25rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 8px;
    line-height: 1.2;
  }
  
  /* Notifications adaptées aux petits écrans */
  .global-notification {
    position: fixed;
    bottom: 10px;
    left: 10px;
    right: 10px;
    padding: 14px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    text-align: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }
  
  .notification-icon {
    font-size: 1.1rem;
  }
}

/* Styles pour écrans extra-petits */
@media (max-width: 360px) {
  body {
    font-size: 15px;
    line-height: 1.4;
  }
  
  h1 {
    font-size: 1.125rem;
    line-height: 1.2;
  }
  
  h2 {
    font-size: 1rem;
    line-height: 1.2;
  }
  
  h3 {
    font-size: 0.95rem;
    line-height: 1.2;
  }
  
  input, select, textarea {
    padding: 0.75rem;
    font-size: 16px;
  }
  
  button {
    min-height: 44px;
    padding: 0.75rem 1rem;
    font-size: 0.95rem;
  }
  
  .global-notification {
    padding: 12px 14px;
    font-size: 0.85rem;
  }
}

/* Optimisations tactiles et d'accessibilité */
@media (max-width: 768px) {
  /* Amélioration des zones tactiles */
  a, button, [role="button"], input[type="checkbox"], input[type="radio"] {
    min-height: 44px;
    min-width: 44px;
  }
  
  /* Amélioration du contraste */
  input, select, textarea {
    background-color: rgba(255, 255, 255, 0.95);
    color: var(--dark);
  }
  
  /* Désactivation des animations coûteuses sur mobile */
  *, *::before, *::after {
    animation-duration: 0.2s !important;
    animation-delay: 0s !important;
    transition-duration: 0.2s !important;
  }
  
  /* Amélioration de la barre de défilement sur mobile */
  ::-webkit-scrollbar {
    width: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: var(--primary);
    border-radius: 2px;
  }
  
  /* Optimisation de la sélection de texte */
  ::selection {
    background-color: rgba(74, 124, 89, 0.3);
    color: var(--dark);
  }
  
  /* Amélioration des focus outlines pour l'accessibilité */
  *:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }
  
  button:focus, input:focus, select:focus, textarea:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.2);
  }
}

/* Styles pour mode paysage sur mobile */
@media (max-width: 768px) and (orientation: landscape) {
  .app-container {
    min-height: 100vh;
  }
  
  h1, h2, h3 {
    margin-bottom: 0.5rem;
  }
  
  .global-notification {
    bottom: 5px;
    padding: 10px 16px;
    font-size: 0.85rem;
  }
}

/* Optimisations spécifiques pour iOS */
@supports (-webkit-touch-callout: none) {
  /* Styles spécifiques iOS */
  input, select, textarea {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 8px;
  }
  
  button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
}

/* Optimisations pour les connexions lentes */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style> 