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
import axios from './utils/axios';
import { mapState, mapMutations, mapActions } from 'vuex';

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
      
      // SAUVEGARDE CRITIQUE: Stocker l'heure de dernière activité pour détecter les inactivités prolongées
      const now = Date.now();
      const lastActivity = parseInt(localStorage.getItem('last_activity') || '0');
      const inactivityDuration = now - lastActivity;
      
      // Mise à jour de l'heure de dernière activité
      localStorage.setItem('last_activity', now.toString());
      
      console.log(`[DEBUG] Dernière activité: ${lastActivity ? new Date(lastActivity).toLocaleString() : 'jamais'}`);
      if (lastActivity) {
        console.log(`[DEBUG] Temps d'inactivité: ${(inactivityDuration / (1000 * 60)).toFixed(1)} minutes`);
      }
      
      // Vérification de sécurité si inactivité prolongée (plus de 30 minutes)
      // Sauvegarder une copie des données dans un stockage de secours
      if (lastActivity && inactivityDuration > 30 * 60 * 1000) {
        console.log('[DEBUG] Inactivité prolongée détectée, sauvegarde de sécurité...');
        const backupKey = 'todos_backup_' + new Date().toISOString().replace(/[:.]/g, '_');
        
        try {
          // Copier les todos actuels dans un stockage de secours
          const todosData = localStorage.getItem('todos');
          if (todosData && todosData.length > 2) {
            localStorage.setItem(backupKey, todosData);
            console.log(`[DEBUG] Sauvegarde de sécurité créée: ${backupKey}`);
            
            // Limiter le nombre de sauvegardes à 5
            const backups = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('todos_backup_')) {
                backups.push(key);
              }
            }
            
            // Trier et supprimer les plus anciennes si plus de 5
            if (backups.length > 5) {
              backups.sort();
              const toDelete = backups.slice(0, backups.length - 5);
              toDelete.forEach(key => {
                localStorage.removeItem(key);
                console.log(`[DEBUG] Suppression d'une ancienne sauvegarde: ${key}`);
              });
            }
          }
        } catch (e) {
          console.error('[DEBUG] Erreur lors de la sauvegarde de sécurité:', e);
        }
      }
      
      // Flag pour suivre si c'est le premier chargement de l'application
      const isFirstTabOpen = !sessionStorage.getItem('appInitialized');
      
      // Marquer l'application comme initialisée dans cette session
      sessionStorage.setItem('appInitialized', 'true');
      
      // Si c'est le premier onglet ouvert, supprimer toute notification existante
      if (isFirstTabOpen) {
        console.log('[DEBUG] Premier onglet détecté - Suppression des notifications automatiques');
        store.commit('SET_NOTIFICATION_STATUS', null);
      } else {
        console.log('[DEBUG] Onglet supplémentaire détecté - Mode silencieux activé');
      }
      
      // Ajouter un écouteur d'événement pour la déconnexion forcée
      window.addEventListener('force-logout', (event) => {
        console.log('[DEBUG] Événement de déconnexion forcée reçu:', event.detail);
        
        // Afficher une notification à l'utilisateur
        store.commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: event.detail?.message || 'Session expirée. Veuillez vous reconnecter.'
        });
        
        // Forcer la déconnexion
        store.commit('LOGOUT');
      });
      
      // Tenter de récupérer l'utilisateur si les informations sont partiellement disponibles
      await recoverUserIfNeeded();
      
      // Effectuer un ping immédiat pour maintenir la session active
      await pingServer();
      
      // Vérifier l'authentification de l'utilisateur
      try {
        await store.dispatch('checkAuth');
      } catch (error) {
        console.error('[DEBUG] Erreur lors de la vérification de l\'authentification:', error);
      }
      
      // Si l'utilisateur est authentifié, vérifier s'il y a des sauvegardes de déconnexion
      if (store.state.isAuthenticated) {
        console.log('[DEBUG] Utilisateur authentifié - Vérification des sauvegardes de déconnexion');
        await checkForLogoutBackups();
        
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
        // Appeler notre fonction d'aide pour récupérer l'utilisateur si nécessaire
        await recoverUserIfNeeded();
      
        // Essayer de récupérer les données avec retry
        const result = await fetchWithRetry();
        
        // Vérifier le chargement
        const todosCount = store.state.todos.length;
        console.log(`[DEBUG] Nombre de tâches après chargement: ${todosCount}`);
        
        // PROTECTION CRITIQUE: Si aucune tâche n'a été chargée mais qu'il existe une sauvegarde, la restaurer
        if (todosCount === 0) {
          console.log('[DEBUG] Aucune tâche chargée, recherche de sauvegardes...');
          
          // Chercher d'abord dans les sauvegardes spéciales
          const backupKeys = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('todos_backup_')) {
              backupKeys.push(key);
            }
          }
          
          // Si des sauvegardes existent, utiliser la plus récente
          if (backupKeys.length > 0) {
            backupKeys.sort();
            const latestBackup = backupKeys[backupKeys.length - 1];
            try {
              const backupData = localStorage.getItem(latestBackup);
              if (backupData && backupData.length > 2) {
                const backupTodos = JSON.parse(backupData);
                console.log(`[DEBUG] Restauration depuis la sauvegarde ${latestBackup}: ${backupTodos.length} tâches`);
                store.commit('SET_TODOS', backupTodos);
                
                // Sauvegarder dans le stockage principal
                localStorage.setItem('todos', backupData);
                
                // Notification à l'utilisateur
                store.commit('SET_NOTIFICATION_STATUS', {
                  success: true,
                  message: 'Vos tâches ont été restaurées depuis une sauvegarde'
                });
              }
            } catch (e) {
              console.error('[DEBUG] Erreur lors de la restauration de la sauvegarde:', e);
            }
          } else if (localTodos && Array.isArray(localTodos) && localTodos.length > 0) {
            console.log('[DEBUG] Aucune tâche chargée depuis le serveur mais présentes en local, chargement de secours...');
            store.commit('SET_TODOS', localTodos);
          }
        }
        
        // Force sauvegarder après tout le processus pour s'assurer que les données sont persistées
        window.setTimeout(forceSaveTodos, 500);
        
        // Configurer la synchronisation périodique (toutes les 2 minutes)
        syncInterval = setInterval(syncTodos, 2 * 60 * 1000);
        
        // Configurer une vérification périodique de l'authentification (toutes les 10 minutes)
        const authCheckInterval = setInterval(async () => {
          console.log('[DEBUG] Vérification périodique de l\'authentification...');
          await recoverUserIfNeeded();
        }, 10 * 60 * 1000);
        
        // Configurer le ping périodique pour maintenir la session active (toutes les 3 minutes)
        const pingInterval = setInterval(async () => {
          console.log('[DEBUG] Envoi du ping périodique...');
          await pingServer();
        }, 3 * 60 * 1000);
        
        // Ajout d'une sauvegarde périodique toutes les 30 secondes
        const saveInterval = setInterval(forceSaveTodos, 30 * 1000);
        
        // Ajouter un écouteur d'événement pour détecter la reprise après veille
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Ajouter un gestionnaire d'événements pour l'état de connexion
        window.addEventListener('online', () => {
          console.log('[DEBUG] Connexion internet rétablie - Synchronisation des tâches');
          syncTodos();
          // Tenter également de récupérer l'utilisateur si nécessaire
          recoverUserIfNeeded();
        });
        
        // Sauvegarder avant fermeture de la page
        window.addEventListener('beforeunload', async (event) => {
          console.log('[DEBUG] Page en cours de fermeture - Sauvegarde des tâches');
          
          // Tentative de synchronisation d'urgence
          try {
            await emergencySync();
          } catch (e) {
            console.error('[DEBUG] Échec de la synchronisation d\'urgence:', e);
          }
          
          // Sauvegarde locale en dernier recours
          forceSaveTodos();
          
          // Demander confirmation si des modifications sont en cours (optionnel)
          if (store.state.todos.length > 0) {
            event.preventDefault();
            event.returnValue = 'Vos tâches sont en cours de sauvegarde. Êtes-vous sûr de vouloir quitter la page ?';
            return event.returnValue;
          }
        });
        
        // Nettoyer les intervalles lors de la destruction
        onUnmounted(() => {
          clearInterval(syncInterval);
          clearInterval(saveInterval);
          clearInterval(authCheckInterval);
          clearInterval(pingInterval);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
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