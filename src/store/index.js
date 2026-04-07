import { createStore } from 'vuex'
import axios from '../utils/axios'

// Clé utilisée pour le stockage dans localStorage
const STORAGE_KEY = 'todos';

// Nouvelle clé pour les timestamps des notifications envoyées
const NOTIFICATION_SENT_KEY = 'notification_timestamps';

// Fonction pour charger les timestamps des notifications du localStorage
const loadNotificationTimestamps = () => {
  try {
    const timestamps = localStorage.getItem(NOTIFICATION_SENT_KEY);
    return timestamps ? JSON.parse(timestamps) : {};
  } catch (error) {
    console.error('[DEBUG] Erreur lors du chargement des timestamps de notification:', error);
    return {};
  }
};

// Fonction pour enregistrer un nouveau timestamp de notification
const saveNotificationTimestamp = (todoId, timestamp = Date.now()) => {
  try {
    const timestamps = loadNotificationTimestamps();
    timestamps[todoId] = timestamp;
    localStorage.setItem(NOTIFICATION_SENT_KEY, JSON.stringify(timestamps));
    return true;
  } catch (error) {
    console.error('[DEBUG] Erreur lors de la sauvegarde du timestamp de notification:', error);
    return false;
  }
};

// Fonction pour vérifier si une notification a déjà été envoyée récemment
const hasRecentNotification = (todoId, cooldownHours = 12) => {
  try {
    const timestamps = loadNotificationTimestamps();
    const lastTimestamp = timestamps[todoId];
    
    if (!lastTimestamp) return false;
    
    const now = Date.now();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;
    
    // Si la dernière notification a été envoyée il y a moins de X heures, ne pas renvoyer
    return (now - lastTimestamp) < cooldownMs;
  } catch (error) {
    console.error('[DEBUG] Erreur lors de la vérification des timestamps de notification:', error);
    return false;
  }
};

// NOUVEAU: Détection et gestion des problèmes mobiles
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isIOSSafari = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS/.test(ua) && !/FxiOS/.test(ua);
};

const isStandalone = () => {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
};

// Test de la disponibilité du localStorage (spécialement important sur mobile)
const testLocalStorageAvailability = () => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, 'test');
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    console.error('[MOBILE] localStorage non disponible:', e.message);
    return false;
  }
};

// Stratégie de stockage robuste pour mobile
const mobileRobustStorage = {
  // Stockage de secours utilisant plusieurs méthodes
  stores: ['localStorage', 'sessionStorage', 'memory'],
  memoryStore: new Map(),
  
  setItem(key, value) {
    const success = { localStorage: false, sessionStorage: false, memory: false };
    
    // Essayer localStorage en premier
    try {
      if (testLocalStorageAvailability()) {
        localStorage.setItem(key, value);
        success.localStorage = true;
        console.log('[MOBILE] Sauvegarde localStorage réussie');
      }
    } catch (e) {
      console.warn('[MOBILE] Échec localStorage:', e.message);
    }
    
    // Essayer sessionStorage en secours
    try {
      sessionStorage.setItem(key, value);
      success.sessionStorage = true;
      console.log('[MOBILE] Sauvegarde sessionStorage réussie');
    } catch (e) {
      console.warn('[MOBILE] Échec sessionStorage:', e.message);
    }
    
    // Toujours sauvegarder en mémoire
    this.memoryStore.set(key, value);
    success.memory = true;
    
    return success;
  },
  
  getItem(key) {
    // Essayer dans l'ordre de priorité
    try {
      if (testLocalStorageAvailability()) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          console.log('[MOBILE] Données récupérées depuis localStorage');
          return value;
        }
      }
    } catch (e) {
      console.warn('[MOBILE] Erreur lecture localStorage:', e.message);
    }
    
    try {
      const value = sessionStorage.getItem(key);
      if (value !== null) {
        console.log('[MOBILE] Données récupérées depuis sessionStorage');
        return value;
      }
    } catch (e) {
      console.warn('[MOBILE] Erreur lecture sessionStorage:', e.message);
    }
    
    // En dernier recours, utiliser la mémoire
    if (this.memoryStore.has(key)) {
      console.log('[MOBILE] Données récupérées depuis la mémoire');
      return this.memoryStore.get(key);
    }
    
    return null;
  },
  
  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
    
    try {
      sessionStorage.removeItem(key);
    } catch (e) {}
    
    this.memoryStore.delete(key);
  }
};

// Fonction pour sauvegarder les todos dans le localStorage avec gestion d'erreur
const saveTodosToStorage = (todos) => {
  // NOUVEAU: Détecter l'environnement mobile et utiliser le stockage robuste
  const isMobileEnv = isMobile();
  const isIOSEnv = isIOSSafari();
  const isStandaloneMode = isStandalone();
  
  console.log(`[MOBILE] Environnement détecté - Mobile: ${isMobileEnv}, iOS: ${isIOSEnv}, Standalone: ${isStandaloneMode}`);
  
  try {
    // Vérifier que todos est bien un tableau
    if (!Array.isArray(todos)) {
      console.error('[DEBUG] Tentative de sauvegarde de données non valides dans localStorage:', todos)
      return false
    }
    
    // PROTECTION ANTI-EFFACEMENT MODIFIÉE: 
    // Vérifier si on tente de sauvegarder un tableau vide alors que des données existent déjà
    if (todos.length === 0) {
      // Vérifier s'il y a des données existantes (en utilisant le stockage robuste sur mobile)
      let existingData;
      if (isMobileEnv) {
        existingData = mobileRobustStorage.getItem(STORAGE_KEY);
      } else {
        existingData = localStorage.getItem(STORAGE_KEY);
      }
      
      if (existingData && existingData.length > 2 && existingData !== '[]') {
        try {
          const existingTodos = JSON.parse(existingData);
          
          // Récupérer l'utilisateur actuel
          const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
          const currentUserId = currentUser?.id;
          
          // Si les todos existants appartiennent à un autre utilisateur, permettre l'écrasement
          if (currentUserId && Array.isArray(existingTodos) && existingTodos.length > 0) {
            // Vérifier si au moins une tâche appartient à un autre utilisateur
            const hasForeignTodos = existingTodos.some(todo => 
              todo.userId && todo.userId !== currentUserId
            );
            
            if (hasForeignTodos) {
              console.log('[DEBUG] Changement d\'utilisateur détecté - Autorisation d\'effacer les anciennes tâches');
              // On permet l'écrasement car ce sont des tâches d'un autre utilisateur
              return true;
            } else {
              console.warn('[DEBUG] PROTECTION ANTI-EFFACEMENT: Tentative d\'écraser des données existantes avec un tableau vide! Opération annulée.');
              console.log('[DEBUG] Données existantes préservées:', existingData.substring(0, 100) + '...');
              return false; // Ne pas sauvegarder un tableau vide par dessus des données existantes
            }
          } else if (Array.isArray(existingTodos) && existingTodos.length > 0) {
            console.warn('[DEBUG] PROTECTION ANTI-EFFACEMENT: Tentative d\'écraser des données existantes avec un tableau vide! Opération annulée.');
            console.log('[DEBUG] Données existantes préservées:', existingData.substring(0, 100) + '...');
            return false; // Ne pas sauvegarder un tableau vide par dessus des données existantes
          }
        } catch (parseError) {
          console.error('[DEBUG] Erreur lors de la vérification des données existantes:', parseError);
        }
      }
    }
    
    // Sauvegarder les données
    const jsonString = JSON.stringify(todos);
    console.log('[DEBUG] Sauvegarde dans localStorage:', jsonString);
    
    if (isMobileEnv) {
      // NOUVEAU: Utiliser le stockage robuste sur mobile
      const success = mobileRobustStorage.setItem(STORAGE_KEY, jsonString);
      console.log(`[MOBILE] Résultats de sauvegarde:`, success);
      
      // Créer des sauvegardes supplémentaires pour mobile
      const backupKey = `${STORAGE_KEY}_mobile_backup`;
      mobileRobustStorage.setItem(backupKey, jsonString);
      mobileRobustStorage.setItem(`${backupKey}_timestamp`, Date.now().toString());
      
      // Vérification spéciale pour mobile
      const savedData = mobileRobustStorage.getItem(STORAGE_KEY);
      if (savedData !== jsonString) {
        console.warn('[MOBILE] Problème de sauvegarde détecté, utilisation du stockage de secours');
        
        // En mode mobile, même si localStorage échoue, on considère le succès si une autre méthode fonctionne
        if (success.sessionStorage || success.memory) {
          console.log('[MOBILE] Sauvegarde alternative réussie');
          return true;
        }
        return false;
      }
      
      console.log(`[MOBILE] ${todos.length} todos sauvegardés avec succès`);
      return true;
      
    } else {
      // Comportement normal pour desktop
      // NOUVELLE STRATÉGIE: Doublement des sauvegardes pour éviter la corruption
      localStorage.setItem(STORAGE_KEY, jsonString);
      
      // Utiliser aussi un stockage de secours avec timestamp
      const backupKey = `${STORAGE_KEY}_backup`;
      localStorage.setItem(backupKey, jsonString);
      localStorage.setItem(`${backupKey}_timestamp`, Date.now().toString());
      
      // Double vérification de la sauvegarde
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData !== jsonString) {
        console.error('[DEBUG] Problème lors de la sauvegarde dans localStorage - Les données ne correspondent pas:', 
          'Sauvegardé:', savedData, 
          'Original:', jsonString);
        
        // Tentative de récupération depuis la sauvegarde
        const backupData = localStorage.getItem(backupKey);
        if (backupData === jsonString) {
          console.log('[DEBUG] Récupération depuis la sauvegarde de secours');
          localStorage.setItem(STORAGE_KEY, backupData);
          return true;
        }
        
        return false;
      }
      
      console.log(`[DEBUG] ${todos.length} todos sauvegardés dans localStorage (${jsonString.length} caractères)`)
      return true;
    }
    
  } catch (error) {
    console.error('[DEBUG] Erreur lors de la sauvegarde des todos dans localStorage:', error)
    
    // NOUVEAU: Gestion d'erreur spéciale pour mobile
    if (isMobileEnv) {
      console.log('[MOBILE] Tentative de sauvegarde de secours sur mobile...');
      try {
        const jsonString = JSON.stringify(todos);
        // Essayer de forcer la sauvegarde dans sessionStorage et mémoire
        const fallbackSuccess = mobileRobustStorage.setItem(`${STORAGE_KEY}_emergency`, jsonString);
        if (fallbackSuccess.sessionStorage || fallbackSuccess.memory) {
          console.log('[MOBILE] Sauvegarde d\'urgence réussie');
          return true;
        }
      } catch (fallbackError) {
        console.error('[MOBILE] Échec total de la sauvegarde:', fallbackError);
      }
    }
    
    // En cas d'erreur, tenter une nouvelle fois avec un délai
    try {
      setTimeout(() => {
        console.log('[DEBUG] Tentative de sauvegarde de secours après erreur...');
        const jsonString = JSON.stringify(todos);
        if (isMobileEnv) {
          mobileRobustStorage.setItem(STORAGE_KEY, jsonString);
        } else {
          localStorage.setItem(STORAGE_KEY, jsonString);
        }
        console.log('[DEBUG] Sauvegarde de secours réussie');
      }, 500);
    } catch (retryError) {
      console.error('[DEBUG] Échec de la sauvegarde de secours:', retryError);
    }
    
    return false;
  }
}

// NOUVELLE FONCTION: Récupération des datos en cas de problème
const recoverTodosFromBackup = () => {
  try {
    console.log('[DEBUG] Tentative de récupération depuis la sauvegarde de secours...');
    
    // Vérifier d'abord les données principales
    const mainData = localStorage.getItem(STORAGE_KEY);
    if (mainData && mainData.length > 2 && mainData !== '[]') {
      try {
        const mainTodos = JSON.parse(mainData);
        if (Array.isArray(mainTodos) && mainTodos.length > 0) {
          console.log('[DEBUG] Données principales valides:', mainTodos.length, 'tâches');
          return mainTodos;
        }
      } catch (parseError) {
        console.error('[DEBUG] Erreur lors du parsing des données principales:', parseError);
      }
    }
    
    // Si les données principales sont invalides, essayer la sauvegarde
    const backupKey = `${STORAGE_KEY}_backup`;
    const backupData = localStorage.getItem(backupKey);
    
    if (backupData && backupData.length > 2 && backupData !== '[]') {
      try {
        const backupTodos = JSON.parse(backupData);
        if (Array.isArray(backupTodos) && backupTodos.length > 0) {
          console.log('[DEBUG] Récupération réussie depuis la sauvegarde:', backupTodos.length, 'tâches');
          
          // Restaurer dans le stockage principal
          localStorage.setItem(STORAGE_KEY, backupData);
          
          return backupTodos;
        }
      } catch (parseError) {
        console.error('[DEBUG] Erreur lors du parsing de la sauvegarde:', parseError);
      }
    }
    
    // Chercher d'autres sauvegardes nommées
    const backupKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('todos_backup_')) {
        backupKeys.push(key);
      }
    }
    
    if (backupKeys.length > 0) {
      // Trier pour avoir la plus récente
      backupKeys.sort();
      const latestBackup = backupKeys[backupKeys.length - 1];
      
      try {
        const namedBackupData = localStorage.getItem(latestBackup);
        if (namedBackupData && namedBackupData.length > 2) {
          const namedBackupTodos = JSON.parse(namedBackupData);
          if (Array.isArray(namedBackupTodos) && namedBackupTodos.length > 0) {
            console.log(`[DEBUG] Récupération réussie depuis la sauvegarde nommée ${latestBackup}:`, namedBackupTodos.length, 'tâches');
            
            // Restaurer dans le stockage principal
            localStorage.setItem(STORAGE_KEY, namedBackupData);
            
            return namedBackupTodos;
          }
        }
      } catch (parseError) {
        console.error('[DEBUG] Erreur lors du parsing de la sauvegarde nommée:', parseError);
      }
    }
    
    console.log('[DEBUG] Aucune sauvegarde valide trouvée');
    return [];
  } catch (error) {
    console.error('[DEBUG] Erreur lors de la récupération depuis les sauvegardes:', error);
    return [];
  }
};

// Modifions la fonction loadTodosFromStorage pour utiliser le système de récupération
const loadTodosFromStorage = () => {
  // NOUVEAU: Utiliser le stockage robuste sur mobile
  const isMobileEnv = isMobile();
  
  try {
    let savedTodos;
    if (isMobileEnv) {
      savedTodos = mobileRobustStorage.getItem(STORAGE_KEY);
      console.log('[MOBILE] Chargement des todos depuis le stockage robuste:', savedTodos ? `Données trouvées (${savedTodos.length} caractères)` : 'Aucune donnée');
    } else {
      savedTodos = localStorage.getItem(STORAGE_KEY);
      console.log('[DEBUG] Chargement des todos depuis localStorage:', savedTodos ? `Données trouvées (${savedTodos.length} caractères)` : 'Aucune donnée');
    }
    
    // Afficher le contenu brut pour diagnostic
    if (savedTodos) {
      console.log('[DEBUG] Contenu brut du stockage:', savedTodos);
    }
    
    // Si pas de données, essayer la récupération
    if (!savedTodos || savedTodos === '[]') {
      if (!savedTodos) {
        console.log('[DEBUG] Aucune donnée trouvée, tentative de récupération...');
      } else {
        console.log('[DEBUG] Tableau vide détecté dans le stockage, tentative de récupération...');
      }
      
      // NOUVEAU: Récupération spéciale pour mobile
      if (isMobileEnv) {
        // Essayer de récupérer depuis les sauvegardes mobiles
        const mobileBackup = mobileRobustStorage.getItem(`${STORAGE_KEY}_mobile_backup`);
        if (mobileBackup && mobileBackup.length > 2) {
          try {
            const backupTodos = JSON.parse(mobileBackup);
            if (Array.isArray(backupTodos) && backupTodos.length > 0) {
              console.log('[MOBILE] Récupération depuis la sauvegarde mobile:', backupTodos.length, 'tâches');
              // Restaurer dans le stockage principal
              mobileRobustStorage.setItem(STORAGE_KEY, mobileBackup);
              return backupTodos;
            }
          } catch (e) {
            console.error('[MOBILE] Erreur lors de la récupération mobile:', e);
          }
        }
        
        // Essayer la sauvegarde d'urgence
        const emergencyBackup = mobileRobustStorage.getItem(`${STORAGE_KEY}_emergency`);
        if (emergencyBackup && emergencyBackup.length > 2) {
          try {
            const emergencyTodos = JSON.parse(emergencyBackup);
            if (Array.isArray(emergencyTodos) && emergencyTodos.length > 0) {
              console.log('[MOBILE] Récupération depuis la sauvegarde d\'urgence:', emergencyTodos.length, 'tâches');
              return emergencyTodos;
            }
          } catch (e) {
            console.error('[MOBILE] Erreur lors de la récupération d\'urgence:', e);
          }
        }
      }
      
      const recoveredTodos = recoverTodosFromBackup();
      if (recoveredTodos.length > 0) {
        return recoveredTodos;
      }
      
      return [];
    }
    
    // Parser les données JSON
    try {
      const parsedTodos = JSON.parse(savedTodos)
      
      // Vérifier que c'est bien un tableau
      if (Array.isArray(parsedTodos)) {
        console.log(`[DEBUG] ${parsedTodos.length} todos chargés depuis localStorage`);
        
        // IMPORTANT: Filtrer par utilisateur actuel
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const currentUserId = currentUser?.id;
        
        if (currentUserId) {
          console.log(`[DEBUG] Filtrage des todos pour l'utilisateur actuel: ${currentUserId}`);
          const filteredTodos = parsedTodos.filter(todo => {
            // Garder UNIQUEMENT les tâches de l'utilisateur actuel
            return todo.userId === currentUserId;
          });
          
          console.log(`[DEBUG] Après filtrage: ${filteredTodos.length}/${parsedTodos.length} todos correspondent à l'utilisateur actuel`);
          
          // Si des tâches ont été filtrées, mettre à jour le localStorage pour ne garder que les tâches de l'utilisateur actuel
          if (filteredTodos.length < parsedTodos.length) {
            console.log('[DEBUG] Nettoyage du localStorage pour ne garder que les tâches de l\'utilisateur actuel');
            saveTodosToStorage(filteredTodos);
          }
          
          return filteredTodos;
        }
        
        return parsedTodos
      } else {
        console.error('[DEBUG] Format de données invalide dans localStorage (pas un tableau):', parsedTodos);
        // Essayer de convertir un objet en tableau si possible
        if (typeof parsedTodos === 'object' && parsedTodos !== null) {
          console.log('[DEBUG] Tentative de conversion objet -> tableau');
          return Object.values(parsedTodos);
        }
        
        // Si conversion impossible, tenter la récupération
        const recoveredTodos = recoverTodosFromBackup();
        if (recoveredTodos.length > 0) {
          return recoveredTodos;
        }
        
        return []
      }
    } catch (parseError) {
      console.error('[DEBUG] Erreur de parsing JSON:', parseError, 'pour les données:', savedTodos);
      
      // En cas d'erreur de parsing, tenter la récupération
      const recoveredTodos = recoverTodosFromBackup();
      if (recoveredTodos.length > 0) {
        return recoveredTodos;
      }
      
      return [];
    }
  } catch (error) {
    console.error('[DEBUG] Erreur lors du chargement des todos depuis localStorage:', error)
    
    // En cas d'erreur générale, tenter la récupération
    const recoveredTodos = recoverTodosFromBackup();
    if (recoveredTodos.length > 0) {
      return recoveredTodos;
    }
    
    return []
  }
}

// Flag pour suivre si c'est la première fois que l'application charge
let isFirstLoad = true;

// Nouvelle stratégie : priorité à la base de données
const shouldUseDatabase = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const authToken = localStorage.getItem('authToken');
  return !!(user && authToken);
};

// *** DIAGNOSTIC DE LANCEMENT ***
// Vérifier l'état initial du localStorage au chargement du module
const initialDiagnostic = () => {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      keys.push(localStorage.key(i));
    }
    console.log('[DIAGNOSTIC] Clés disponibles dans localStorage:', keys);
    
    const todosRaw = localStorage.getItem(STORAGE_KEY);
    console.log('[DIAGNOSTIC] Contenu brut pour la clé todos:', todosRaw);
    
    // Vérifier si l'utilisateur est connecté
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const authToken = localStorage.getItem('authToken');
    console.log('[DIAGNOSTIC] Utilisateur connecté:', !!user, 'Token:', !!authToken);
    console.log('[DIAGNOSTIC] Stratégie de stockage:', shouldUseDatabase() ? 'Base de données' : 'localStorage uniquement');
    
    // Tester si une sauvegarde fonctionne
    const testArray = [{id: 'test', title: 'Test initial'}];
    const testJson = JSON.stringify(testArray);
    localStorage.setItem('test_array', testJson);
    
    const testResult = localStorage.getItem('test_array');
    console.log('[DIAGNOSTIC] Test de sauvegarde localStorage:', 
      testResult === testJson ? 'Succès' : 'Échec',
      'Original:', testJson,
      'Récupéré:', testResult);
  } catch (e) {
    console.error('[DIAGNOSTIC] Erreur lors du diagnostic initial:', e);
  }
};

// Exécuter le diagnostic au chargement
initialDiagnostic();

export default createStore({
  state: {
    // NOUVELLE STRATÉGIE: Charger depuis localStorage seulement si pas connecté
    todos: shouldUseDatabase() ? [] : loadTodosFromStorage(),
    loading: false,
    error: null,
    isOfflineMode: false,
    notificationStatus: null,
    // Nouvelles propriétés pour l'authentification
    user: JSON.parse(localStorage.getItem('user')) || null,
    isAuthenticated: !!localStorage.getItem('authToken'),
    // Nouvelle propriété pour la synchronisation d'urgence
    emergencySyncInProgress: false,
    // Nouvelle propriété pour contrôler les notifications au démarrage
    suppressInitialNotifications: false,
    // Nouvelle propriété pour suivre la stratégie de stockage
    useDatabase: shouldUseDatabase()
  },
  getters: {
    sortedTodos: (state) => {
      // S'assurer que state.todos est un tableau avant de le trier
      const todos = Array.isArray(state.todos) ? state.todos : [];
      return [...todos].sort((a, b) => {
        if (!a.dueDate || !b.dueDate) return 0;
        // Convertir date et heure en timestamp pour comparaison
        const dateA = new Date(`${a.dueDate}T${a.dueTime || '00:00'}`).getTime();
        const dateB = new Date(`${b.dueDate}T${b.dueTime || '00:00'}`).getTime();
        return dateA - dateB;
      });
    },
    isUrgent: () => (todo) => {
      if (!todo || !todo.dueDate) return false;
      const now = new Date().getTime();
      const dueDate = new Date(`${todo.dueDate}T${todo.dueTime || '00:00'}`).getTime();
      const hoursLeft = (dueDate - now) / (1000 * 60 * 60);
      return hoursLeft <= 24 && hoursLeft > 0;
    },
    todosWithNotifications: (state) => {
      return state.todos.filter(todo => todo.notificationsEnabled && !todo.completed);
    },
    // Getters pour l'authentification
    currentUser: (state) => state.user,
    isAuthenticated: (state) => state.isAuthenticated
  },
  mutations: {
    SET_LOADING(state, value) {
      state.loading = value;
    },
    SET_ERROR(state, error) {
      state.error = error;
    },
    SET_TODOS(state, todos) {
      console.log(`[DEBUG] SET_TODOS: Mise à jour des todos avec ${Array.isArray(todos) ? todos.length : 'non-tableau'} éléments`);
      
      // S'assurer que nous avons un tableau valide
      if (!Array.isArray(todos)) {
        console.error('[DEBUG] SET_TODOS: Données non valides reçues:', todos);
        todos = [];
      }
      
      // AMÉLIORATION: Si l'utilisateur est connecté, filtrer pour ne garder que ses tâches
      if (state.user && state.user.id) {
        const userId = state.user.id;
        const initialCount = todos.length;
        
        // Filtrer les tâches pour ne conserver que celles de l'utilisateur actuel
        todos = todos.filter(todo => todo.userId === userId);
        
        if (todos.length < initialCount) {
          console.log(`[DEBUG] SET_TODOS: Filtrage par utilisateur - ${todos.length}/${initialCount} tâches appartiennent à l'utilisateur ${userId}`);
        }
      }
      
      // Sauvegarder dans le state
      state.todos = todos;
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] SET_TODOS: Échec de la sauvegarde dans localStorage');
      }
    },
    ADD_TODO(state, todo) {
      console.log('[DEBUG] ADD_TODO:', todo);
      
      if (!todo) {
        console.error('[DEBUG] ADD_TODO: Tentative d\'ajout d\'une tâche nulle ou undefined');
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] ADD_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
      }
      
      // CORRECTIF : Vérifier si la tâche existe déjà pour éviter les doublons
      const todoId = todo._id || todo.id;
      const todoExists = todoId && state.todos.some(t => 
        (t._id && t._id === todoId) || (t.id && t.id === todoId)
      );
      
      if (todoExists) {
        console.warn(`[DEBUG] ADD_TODO: La tâche avec ID ${todoId} existe déjà, mise à jour au lieu d'ajout`);
        // Utiliser la mutation UPDATE_TODO à la place
        const index = state.todos.findIndex(t => 
          (t._id && t._id === todoId) || (t.id && t.id === todoId)
        );
        if (index !== -1) {
          state.todos.splice(index, 1, todo);
        }
      } else {
        // Ajouter la tâche au début du tableau (nouveau comportement)
        state.todos.unshift(todo);
        console.log('[DEBUG] ADD_TODO: Nouvelle tâche ajoutée, total:', state.todos.length);
      }
      
      // IMPORTANTE SAUVEGARDE SUPPLÉMENTAIRE:
      // Utiliser window.setTimeout pour s'assurer que la sauvegarde se produit après la mise à jour de l'état
      window.setTimeout(() => {
        // Sauvegarder dans le localStorage et vérifier le résultat
        const saveSuccess = saveTodosToStorage(state.todos);
        if (!saveSuccess) {
          console.error('[DEBUG] ADD_TODO: Échec de la sauvegarde dans localStorage - Tentative de secours');
          // Tentative de secours: réessayer avec un petit délai
          window.setTimeout(() => {
            const retrySuccess = saveTodosToStorage(state.todos);
            console.log('[DEBUG] ADD_TODO: Tentative de secours:', retrySuccess ? 'Réussie' : 'Échouée');
          }, 300);
        }
      }, 100);
    },
    UPDATE_TODO(state, todo) {
      console.log('[DEBUG] UPDATE_TODO - Début:', todo);
      
      if (!todo) {
        console.error('[DEBUG] UPDATE_TODO: Tentative de mise à jour d\'une tâche nulle ou undefined');
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] UPDATE_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
        return;
      }
      
      // CORRECTIF CRITIQUE: Créer une copie des tâches avant manipulation
      const todosCopy = [...state.todos];
      
      // Compatibilité avec MongoDB (_id) et PostgreSQL (id)
      const todoId = todo._id || todo.id;
      if (!todoId) {
        console.error('[DEBUG] UPDATE_TODO: La tâche n\'a pas d\'ID valide:', todo);
        return;
      }
      
      // Trouver l'index de la tâche à mettre à jour
      const index = todosCopy.findIndex(t => 
        (t._id && t._id === todoId) || (t.id && t.id === todoId)
      );
      
      console.log(`[DEBUG] UPDATE_TODO: Recherche de la tâche avec ID ${todoId}, trouvée à l'index ${index}`);
      
      if (index !== -1) {
        // CORRECTIF: S'assurer que l'id et _id sont cohérents
        if (todo.id && !todo._id) todo._id = todo.id;
        if (todo._id && !todo.id) todo.id = todo._id;
        
        // IMPORTANT: Ne pas utiliser splice qui peut muter l'état de façon incorrecte
        // Créer un nouveau tableau avec la tâche mise à jour
        const updatedTodos = [
          ...todosCopy.slice(0, index),
          todo,
          ...todosCopy.slice(index + 1)
        ];
        
        // Mettre à jour l'état avec le nouveau tableau
        state.todos = updatedTodos;
        
        console.log(`[DEBUG] UPDATE_TODO: Tâche mise à jour à l'index ${index}, nouveau total: ${state.todos.length}`);
      } else {
        console.error(`[DEBUG] UPDATE_TODO: Tâche avec ID ${todoId} non trouvée dans la liste de ${state.todos.length} tâches`);
        // Afficher les IDs des tâches existantes pour débogage
        const existingIds = state.todos.map(t => `${t.id || 'no-id'}/${t._id || 'no-_id'}`).join(', ');
        console.log(`[DEBUG] UPDATE_TODO: IDs existants: ${existingIds}`);
        
        // CORRECTIF CRITIQUE: Si la tâche n'est pas trouvée, l'ajouter plutôt que de la perdre
        console.log('[DEBUG] UPDATE_TODO: Ajout de la tâche non trouvée comme solution de secours');
        state.todos.unshift(todo);
      }
      
      // IMPORTANT: Sauvegarde immédiate puis différée pour garantir la persistance
      const immediateSuccess = saveTodosToStorage(state.todos);
      console.log(`[DEBUG] UPDATE_TODO: Sauvegarde immédiate: ${immediateSuccess ? 'Réussie' : 'Échouée'}`);
      
      // Sauvegarde supplémentaire avec délai pour garantir que l'état est stable
      window.setTimeout(() => {
        const delayedSuccess = saveTodosToStorage(state.todos);
        console.log(`[DEBUG] UPDATE_TODO: Sauvegarde différée (100ms): ${delayedSuccess ? 'Réussie' : 'Échouée'}`);
      }, 100);
    },
    DELETE_TODO(state, id) {
      console.log('[DEBUG] DELETE_TODO:', id);
      
      if (!id) {
        console.error('[DEBUG] DELETE_TODO: ID non valide:', id);
        return;
      }
      
      // S'assurer que state.todos est un tableau
      if (!Array.isArray(state.todos)) {
        console.error('[DEBUG] DELETE_TODO: state.todos n\'est pas un tableau - Réinitialisation');
        state.todos = [];
        return;
      }
      
      // Compter les éléments avant suppression
      const countBefore = state.todos.length;
      
      // On ne garde que les tâches dont ni l'id ni le _id ne correspondent à l'id à supprimer
      state.todos = state.todos.filter(todo => {
        // Si la tâche a un _id, vérifier s'il est différent de l'id à supprimer
        const _idDifferent = !todo._id || todo._id !== id;
        // Si la tâche a un id, vérifier s'il est différent de l'id à supprimer
        const idDifferent = !todo.id || todo.id !== id;
        // Garder la tâche seulement si les deux identifiants sont différents
        return _idDifferent && idDifferent;
      });
      
      // Vérifier si des éléments ont été supprimés
      const countAfter = state.todos.length;
      if (countBefore === countAfter) {
        console.warn(`[DEBUG] DELETE_TODO: Aucune tâche avec ID ${id} n'a été trouvée pour suppression`);
      } else {
        console.log(`[DEBUG] DELETE_TODO: ${countBefore - countAfter} tâche(s) supprimée(s)`);
      }
      
      // Sauvegarder dans le localStorage et vérifier le résultat
      const saveSuccess = saveTodosToStorage(state.todos);
      if (!saveSuccess) {
        console.error('[DEBUG] DELETE_TODO: Échec de la sauvegarde dans localStorage');
      }
    },
    SET_OFFLINE_MODE(state, value) {
      state.isOfflineMode = value;
    },
    SET_NOTIFICATION_STATUS(state, status) {
      state.notificationStatus = status;
    },
    // Mutations pour l'authentification
    SET_USER(state, user) {
      state.user = user;
      localStorage.setItem('user', JSON.stringify(user));
      // Mettre à jour la stratégie de stockage quand l'utilisateur change
      state.useDatabase = shouldUseDatabase();
    },
    SET_AUTHENTICATED(state, value) {
      state.isAuthenticated = value;
      // Mettre à jour la stratégie de stockage quand l'authentification change
      state.useDatabase = shouldUseDatabase();
    },
    LOGOUT(state) {
      // SÉCURITÉ CRITIQUE: Sauvegarder les tâches actuelles avant de se déconnecter
      if (state.todos && state.todos.length > 0) {
        console.log(`[DEBUG] Sauvegarde de sécurité avant déconnexion: ${state.todos.length} tâches`);
        
        try {
          // Créer une sauvegarde spéciale de déconnexion
          const logoutBackupKey = `todos_logout_backup_${Date.now()}`;
          const todosData = JSON.stringify(state.todos);
          localStorage.setItem(logoutBackupKey, todosData);
          console.log(`[DEBUG] Sauvegarde de déconnexion créée: ${logoutBackupKey}`);
          
          // Limiter le nombre de sauvegardes de déconnexion à 3
          const backups = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('todos_logout_backup_')) {
              backups.push(key);
            }
          }
          
          if (backups.length > 3) {
            backups.sort();
            const toDelete = backups.slice(0, backups.length - 3);
            toDelete.forEach(key => {
              localStorage.removeItem(key);
              console.log(`[DEBUG] Suppression d'une ancienne sauvegarde de déconnexion: ${key}`);
            });
          }
        } catch (e) {
          console.error('[DEBUG] Erreur lors de la sauvegarde avant déconnexion:', e);
        }
      }
      
      // Vider les tâches du state avant de se déconnecter
      state.todos = [];
      
      // Vider également le localStorage des todos pour éviter que les tâches
      // d'un utilisateur soient visibles par un autre
      localStorage.removeItem('todos');
      console.log('[DEBUG] LOGOUT: Nettoyage des tâches dans localStorage et state');
      
      // Nettoyer les informations d'authentification
      state.user = null;
      state.isAuthenticated = false;
      state.useDatabase = false; // Retourner en mode localStorage uniquement
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
    },
    SET_EMERGENCY_SYNC_IN_PROGRESS(state, value) {
      state.emergencySyncInProgress = value;
    },
    UPDATE_STORAGE_STRATEGY(state) {
      state.useDatabase = shouldUseDatabase();
      console.log('[DEBUG] Stratégie de stockage mise à jour:', state.useDatabase ? 'Base de données' : 'localStorage uniquement');
    }
  },
  actions: {
    // Force le chargement des données depuis le localStorage si présent
    loadFromLocalStorageOnly({ commit }) {
      console.log('[DEBUG] Chargement de secours depuis localStorage uniquement');
      const localTodos = loadTodosFromStorage();
      
      if (localTodos && localTodos.length > 0) {
        console.log(`[DEBUG] ${localTodos.length} tâches récupérées depuis localStorage (secours)`);
        commit('SET_TODOS', localTodos);
        commit('SET_OFFLINE_MODE', true);
        
        // Afficher la notification seulement si ce n'est pas le premier chargement
        if (!isFirstLoad) {
          commit('SET_NOTIFICATION_STATUS', {
            success: true,
            message: 'Données chargées depuis la sauvegarde locale'
          });
        }
        
        return { success: true, data: localTodos, offline: true };
      } else {
        console.warn('[DEBUG] Aucune donnée dans localStorage pour le chargement de secours');
        return { success: false, error: 'Aucune donnée locale disponible' };
      }
    },
    async fetchTodos({ commit, dispatch, state }) {
      commit('SET_LOADING', true);
      commit('SET_ERROR', null);
      
      // NOUVELLE STRATÉGIE: Si l'utilisateur est connecté, utiliser uniquement la base de données
      if (state.isAuthenticated && state.useDatabase) {
        try {
          console.log('[DEBUG] Mode base de données: récupération des todos depuis le serveur...');
          const { data } = await axios.get('/todos');
          
          // Vérifier la validité des données reçues
          if (!data || !Array.isArray(data)) {
            throw new Error('Format de données invalide reçu du serveur');
          }
          
          console.log(`[DEBUG] ${data.length} todos récupérés depuis la base de données`);
          
          // Mettre à jour le store avec les données de la base de données
          commit('SET_TODOS', data);
          commit('SET_OFFLINE_MODE', false);
          
          // Sauvegarder en cache local pour l'offline
          saveTodosToStorage(data);
          
          if (!isFirstLoad) {
            commit('SET_NOTIFICATION_STATUS', {
              success: true,
              message: 'Données synchronisées depuis la base de données'
            });
          }
          
          // Mettre à jour le flag après le premier chargement
          isFirstLoad = false;
          
          return { success: true, data };
          
        } catch (error) {
          console.error('[DEBUG] Erreur lors de la récupération depuis la base de données:', error);
          
          const errorMessage = error.response?.data?.error || 'Erreur lors du chargement des tâches';
          commit('SET_ERROR', errorMessage);
          
          // En cas d'erreur, essayer de charger depuis le cache local
          const localTodos = loadTodosFromStorage();
          if (localTodos.length > 0) {
            console.log(`[DEBUG] Fallback: utilisation des ${localTodos.length} tâches du cache local`);
            commit('SET_TODOS', localTodos);
            commit('SET_OFFLINE_MODE', true);
            
            if (!isFirstLoad) {
              commit('SET_NOTIFICATION_STATUS', {
                success: true,
                message: 'Utilisation du cache local (problème de connexion)'
              });
            }
            
            isFirstLoad = false;
            return { success: true, data: localTodos, offline: true };
          }
          
          // Si pas de cache local, retourner un tableau vide
          commit('SET_TODOS', []);
          isFirstLoad = false;
          
          return { success: false, error: errorMessage };
        } finally {
          commit('SET_LOADING', false);
        }
      }
      
      // MODE HORS LIGNE: Si l'utilisateur n'est pas connecté, utiliser localStorage uniquement
      try {
        console.log('[DEBUG] Mode hors ligne: utilisation du localStorage uniquement');
        const localTodos = loadTodosFromStorage();
        
        commit('SET_TODOS', localTodos);
        commit('SET_OFFLINE_MODE', true);
        
        console.log(`[DEBUG] ${localTodos.length} todos chargés depuis localStorage`);
        
        if (!isFirstLoad && localTodos.length > 0) {
          commit('SET_NOTIFICATION_STATUS', {
            success: true,
            message: 'Mode hors ligne - données locales uniquement'
          });
        }
        
        // Mettre à jour le flag après le premier chargement
        isFirstLoad = false;
        
        return { success: true, data: localTodos, offline: true };
        
      } catch (error) {
        console.error('[DEBUG] Erreur lors du chargement local:', error);
        commit('SET_ERROR', 'Erreur lors du chargement des données locales');
        commit('SET_TODOS', []);
        isFirstLoad = false;
        
        return { success: false, error: 'Erreur lors du chargement des données locales' };
      } finally {
        commit('SET_LOADING', false);
      }
    },
    async createTodo({ commit, state }, todo) {
      commit('SET_ERROR', null);
      commit('SET_LOADING', true);
      
      try {
        console.log('Store: Tentative de création de la tâche avec les données:', todo);
        
        // Validation de base côté client
        if (!todo.title || todo.title.trim() === '') {
          const errorMessage = 'Le titre de la tâche est requis';
          console.error(errorMessage);
          commit('SET_ERROR', errorMessage);
          commit('SET_LOADING', false);
          return { success: false, error: errorMessage };
        }

        if (!todo.notificationsEnabled) {
          todo.notificationEmail = null;
        } else if (todo.notificationsEnabled && (!todo.notificationEmail || !todo.notificationEmail.trim())) {
          const errorMessage = 'Une adresse email valide est requise pour les notifications';
          commit('SET_ERROR', errorMessage);
          commit('SET_LOADING', false);
          return { success: false, error: errorMessage };
        }

        // Ajouter l'ID utilisateur si authentifié
        if (state.isAuthenticated && state.user) {
          if (!todo.userId) {
            console.log('[DEBUG] Ajout automatique de l\'ID utilisateur à la tâche:', state.user.id);
            todo.userId = state.user.id;
          }
        }

        // NOUVELLE STRATÉGIE: Si connecté, utiliser la base de données
        if (state.isAuthenticated && state.useDatabase) {
          try {
            // Préparer la tâche pour la base de données
            const todoToSend = { ...todo };
            if (todoToSend.id) delete todoToSend.id;
            if (todoToSend._id) delete todoToSend._id;
            
            console.log('[DEBUG] Création via base de données:', todoToSend);
            const { data } = await axios.post('/todos', todoToSend);
            console.log('Réponse API pour createTodo:', data);
            
            if (data && (data._id || data.id)) {
              if (data.id && !data._id) {
                data._id = data.id;
              }
              
              commit('ADD_TODO', data);
              commit('SET_OFFLINE_MODE', false);
              commit('SET_LOADING', false);
              
              return { success: true, data };
            } else {
              throw new Error('Réponse invalide du serveur: ID de tâche manquant');
            }
          } catch (serverError) {
            console.error('[DEBUG] Erreur serveur lors de la création:', serverError);
            
            // En cas d'erreur serveur, créer en local et marquer comme offline
            console.log('[DEBUG] Fallback: création en local après erreur serveur');
            const newTodo = {
              ...todo,
              _id: Math.random().toString(36).substring(2, 15),
              id: Math.random().toString(36).substring(2, 15),
              createdAt: new Date().toISOString()
            };
            
            commit('ADD_TODO', newTodo);
            commit('SET_OFFLINE_MODE', true);
            commit('SET_LOADING', false);
            
            return { success: true, data: newTodo, offline: true };
          }
        }
        
        // MODE HORS LIGNE: Créer uniquement en localStorage
        console.log('[DEBUG] Création en mode hors ligne (localStorage uniquement)');
        const newTodo = {
          ...todo,
          _id: Math.random().toString(36).substring(2, 15),
          id: Math.random().toString(36).substring(2, 15),
          createdAt: new Date().toISOString()
        };
        
        commit('ADD_TODO', newTodo);
        commit('SET_OFFLINE_MODE', true);
        commit('SET_LOADING', false);
        
        return { success: true, data: newTodo, offline: true };
        
      } catch (error) {
        console.error('Erreur dans l\'action createTodo:', error);
        
        let errorMessage = 'Erreur lors de la création de la tâche';
        
        if (error.response) {
          errorMessage = error.response.data?.error || 
                        `Erreur serveur: ${error.response.status} ${error.response.statusText}`;
        } else if (error.request) {
          errorMessage = 'Le serveur n\'a pas répondu à la requête';
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        commit('SET_ERROR', errorMessage);
        commit('SET_LOADING', false);
        
        return { success: false, error: errorMessage };
      }
    },
    async updateTodo({ commit, state }, todo) {
      console.log('[DEBUG] Action updateTodo - Début:', todo);
      
      if (!todo) {
        console.error('[DEBUG] Action updateTodo: Tentative de mise à jour d\'une tâche nulle');
        return { success: false, error: 'Tâche non valide' };
      }
      
      if (todo.hasOwnProperty('notificationsEnabled') && !todo.notificationsEnabled) {
        todo.notificationEmail = null;
      } else if (todo.notificationsEnabled && (!todo.notificationEmail || !todo.notificationEmail.trim())) {
        const errorMessage = 'Une adresse email valide est requise pour les notifications';
        commit('SET_ERROR', errorMessage);
        return { success: false, error: errorMessage };
      }
      
      // CORRECTIF CRITIQUE: S'assurer que la tâche a les deux types d'ID (id et _id)
      if (todo.id && !todo._id) todo._id = todo.id;
      if (todo._id && !todo.id) todo.id = todo._id;
      
      // Sauvegarde préventive de l'état actuel des tâches
      const currentTodos = [...state.todos];
      console.log(`[DEBUG] Action updateTodo: Sauvegarde préventive de ${currentTodos.length} tâches`);
      
      // Vérification préventive si la tâche existe
      const todoId = todo._id || todo.id;
      const todoExists = todoId && currentTodos.some(t => 
        (t._id && t._id === todoId) || (t.id && t.id === todoId)
      );
      
      if (!todoExists) {
        console.warn(`[DEBUG] Action updateTodo: Tâche ${todoId} non trouvée dans la liste locale. Tentative de mise à jour sur le serveur uniquement.`);
      }
      
      commit('SET_ERROR', null);
      try {
        // Utiliser l'ID approprié (compatibilité MongoDB/PostgreSQL)
        const todoId = todo._id || todo.id;
        console.log(`[DEBUG] Action updateTodo: Envoi de la mise à jour au serveur pour l'ID ${todoId}`);
        
        try {
          // Tenter de mettre à jour la tâche existante
          const { data } = await axios.put(`/todos/${todoId}`, todo);
          console.log('[DEBUG] Action updateTodo: Réponse du serveur (mise à jour):', data);
          
          // Si l'objet a seulement id mais pas _id, ajouter _id pour la compatibilité frontend
          if (data.id && !data._id) {
            data._id = data.id;
          }
          
          // CORRECTIF CRITIQUE: Mettre à jour immédiatement sans attendre
          commit('UPDATE_TODO', data);
          commit('SET_OFFLINE_MODE', false);
          
          // Vérification post-mise à jour
          window.setTimeout(() => {
            const updatedTodoExists = state.todos.some(t => 
              (t._id && t._id === todoId) || (t.id && t.id === todoId)
            );
            
            if (!updatedTodoExists) {
              console.error(`[DEBUG] Action updateTodo: La tâche mise à jour ${todoId} a disparu après la mise à jour!`);
              console.log('[DEBUG] Action updateTodo: Réapplication forcée de la mise à jour');
              commit('UPDATE_TODO', data);
            } else {
              console.log(`[DEBUG] Action updateTodo: Mise à jour confirmée pour la tâche ${todoId}`);
            }
          }, 100);
          
          return { success: true, data };
        } catch (updateError) {
          // Si l'erreur est 404 (tâche non trouvée), tenter de créer une nouvelle tâche
          if (updateError.response && updateError.response.status === 404) {
            console.log(`[DEBUG] Action updateTodo: Tâche ${todoId} non trouvée sur le serveur, tentative de création`);
            
            // Préparer la tâche pour création (sans ID)
            const todoToCreate = { ...todo };
            if (todoToCreate.id) delete todoToCreate.id;
            if (todoToCreate._id) delete todoToCreate._id;
            
            // Assurer que l'ID utilisateur est présent
            if (state.isAuthenticated && state.user && !todoToCreate.userId) {
              todoToCreate.userId = state.user.id;
            }
            
            try {
              // Créer une nouvelle tâche
              const { data } = await axios.post('/todos', todoToCreate);
              console.log('[DEBUG] Action updateTodo: Tâche créée avec succès:', data);
              
              // Si l'objet a seulement id mais pas _id, ajouter _id pour la compatibilité frontend
              if (data.id && !data._id) {
                data._id = data.id;
              }
              
              // Mettre à jour le state avec la nouvelle tâche
              commit('ADD_TODO', data);
              commit('SET_OFFLINE_MODE', false);
              
              return { success: true, data, created: true };
            } catch (createError) {
              console.error('[DEBUG] Action updateTodo: Échec de la création après 404:', createError);
              throw createError; // Propager l'erreur
            }
          } else {
            // Pour les autres erreurs, les propager
            throw updateError;
          }
        }
      } catch (error) {
        console.error('[DEBUG] Action updateTodo: Erreur lors de la mise à jour:', error);
        
        const errorMessage = error.response?.data?.error || 'Erreur lors de la mise à jour de la tâche';
        commit('SET_ERROR', errorMessage);
        
        // IMPORTANT: Si c'est une erreur 400, c'est une erreur de validation, pas d'authentification
        if (error.response && error.response.status === 400) {
          console.log('[DEBUG] Erreur 400 de validation détectée dans updateTodo, pas de déconnexion');
          // Ici on ne fait rien de spécial, on laisse simplement l'erreur être gérée normalement
          // mais on ne déclenchera pas de déconnexion
        }
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          console.log('[DEBUG] Action updateTodo: Pas de réponse du serveur, mise à jour locale uniquement');
          commit('SET_OFFLINE_MODE', true);
          
          // CORRECTIF CRITIQUE: Utiliser UPDATE_TODO même en mode offline
          commit('UPDATE_TODO', todo);
          
          // Double vérification après mise à jour
          window.setTimeout(() => {
            const todoStillExists = state.todos.some(t => 
              (t._id && t._id === todoId) || (t.id && t.id === todoId)
            );
            
            if (!todoStillExists) {
              console.error(`[DEBUG] Action updateTodo: La tâche ${todoId} a disparu après la mise à jour locale!`);
              console.log('[DEBUG] Action updateTodo: Réapplication forcée');
              commit('UPDATE_TODO', todo);
            }
          }, 100);
          
          return { success: true, data: todo, offline: true };
        }
        
        // En cas d'erreur du serveur mais avec une réponse
        console.error('[DEBUG] Action updateTodo: Erreur serveur avec réponse:', errorMessage);
        
        // SAUVEGARDE DE SECOURS: Si la mise à jour échoue mais que nous avons la tâche locale, essayons de la mettre à jour
        if (todoExists) {
          console.log('[DEBUG] Action updateTodo: Tentative de mise à jour locale après échec serveur');
          commit('SET_OFFLINE_MODE', true);
          commit('UPDATE_TODO', todo);
        }
        
        return { success: false, error: errorMessage };
      }
    },
    async deleteTodo({ commit, state }, id) {
      commit('SET_ERROR', null);
      try {
        console.log(`[DEBUG] Tentative de suppression de la tâche avec ID: ${id}, type: ${typeof id}`);
        
        // Vérification du type d'ID - PostgreSQL a besoin d'IDs numériques
        // Si l'ID n'est pas numérique mais que le nom ressemble à un ID MongoDB aléatoire,
        // nous devons d'abord chercher la tâche dans le state pour voir si elle a un ID numérique
        let targetId = id;
        
        if (typeof id === 'string' && isNaN(parseInt(id))) {
          console.log(`[DEBUG] ID non numérique détecté: ${id}, recherche d'un ID compatible PostgreSQL`);
          
          // Chercher la tâche dans le state
          const todoInState = state.todos.find(t => 
            (t._id && t._id === id) || (t.id && t.id === id)
          );
          
          if (todoInState) {
            // Si nous avons trouvé la tâche et qu'elle a un ID numérique, utiliser celui-ci
            if (todoInState.id && !isNaN(parseInt(todoInState.id))) {
              targetId = todoInState.id;
              console.log(`[DEBUG] ID numérique trouvé pour cette tâche: ${targetId}`);
            }
          } else {
            console.warn(`[DEBUG] Tâche avec ID ${id} non trouvée dans le state local`);
          }
        }
        
        // Supprimer localement avant de tenter sur le serveur pour une UI plus réactive
        commit('DELETE_TODO', id);
        
        try {
          // Tenter de supprimer sur le serveur
          await axios.delete(`/todos/${targetId}`);
          console.log(`[DEBUG] Suppression réussie sur le serveur pour l'ID ${targetId}`);
          commit('SET_OFFLINE_MODE', false);
        } catch (serverError) {
          console.error(`[DEBUG] Erreur serveur lors de la suppression: ${serverError}`);
          
          // Si l'erreur est 404 (tâche non trouvée), ce n'est pas une erreur critique
          // puisque nous avons déjà supprimé la tâche localement
          if (serverError.response && serverError.response.status === 404) {
            console.log(`[AXIOS] Tâche non trouvée en base de données lors de la suppression`);
            console.log(`[AXIOS] Tentative de suppression locale pour ID: ${id}`);
            
            // Vérifier si la tâche a été supprimée localement
            const todoStillExists = state.todos.some(t => 
              (t._id && t._id === id) || (t.id && t.id === id)
            );
            
            if (todoStillExists) {
              console.log(`[AXIOS] Tâche encore présente localement, suppression forcée`);
              commit('DELETE_TODO', id);
            } else {
              console.log(`[AXIOS] Aucune tâche locale trouvée avec cet ID`);
            }
            
            // Ceci n'est pas une erreur critique, donc on ne lance pas d'exception
            return { success: true, message: "Tâche supprimée localement uniquement" };
          }
          
          // Pour les autres erreurs, on les propage
          throw serverError;
        }
        
        return { success: true };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression de la tâche';
        commit('SET_ERROR', errorMessage);
        
        // Si pas de réponse du serveur, utiliser le stockage local
        if (!error.response) {
          commit('SET_OFFLINE_MODE', true);
          commit('DELETE_TODO', id);
          return { success: true, offline: true };
        }
        
        return { success: false, error: errorMessage };
      }
    },
    async updateNotificationSettings({ commit, dispatch }, { todoId, notificationsEnabled, notificationEmail }) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      try {
        // Si nous activons les notifications, vérifier le cooldown
        if (notificationsEnabled) {
          // Réinitialiser le timestamp lorsque les notifications sont activées/mises à jour
          // pour éviter l'envoi immédiat si elles viennent d'être activées
          saveNotificationTimestamp(todoId);
          console.log(`[DEBUG] Timestamp de notification réinitialisé pour la tâche ${todoId}`);
        }
        
        const { data } = await axios.put(`/notifications/${todoId}`, {
          notificationsEnabled,
          notificationEmail
        });
        
        commit('UPDATE_TODO', data);
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: notificationsEnabled 
            ? 'Notifications activées avec succès' 
            : 'Notifications désactivées'
        });
        
        return { success: true, data };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de la mise à jour des notifications';
        commit('SET_ERROR', errorMessage);
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, error: errorMessage };
      }
    },
    async testNotification({ commit }, { todoId, testEmail }) {
      commit('SET_ERROR', null);
      commit('SET_NOTIFICATION_STATUS', null);
      
      // Vérifier si une notification a déjà été envoyée récemment pour cette tâche
      if (hasRecentNotification(todoId, 1)) { // 1 heure de cooldown pour les tests
        console.log(`[DEBUG] Test de notification pour la tâche ${todoId} ignoré - déjà testé récemment`);
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: 'Un email de test a déjà été envoyé récemment'
        });
        return { success: true, message: 'Email de test déjà envoyé, veuillez attendre avant de tester à nouveau' };
      }
      
      try {
        const { data } = await axios.post(`/notifications/test/${todoId}`, {
          testEmail
        });
        
        // Enregistrer le timestamp de cette notification
        saveNotificationTimestamp(todoId);
        
        commit('SET_NOTIFICATION_STATUS', {
          success: true,
          message: 'Email de test envoyé avec succès'
        });
        
        return { success: true, message: data.message };
      } catch (error) {
        const errorMessage = error.response?.data?.error || 'Erreur lors de l\'envoi de l\'email de test';
        commit('SET_ERROR', errorMessage);
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: errorMessage
        });
        
        return { success: false, error: errorMessage };
      }
    },
    // Action pour déconnecter l'utilisateur
    async logout({ commit, state }) {
      try {
        // Si nous avons des tâches non synchronisées, essayer de les sauvegarder
        if (state.todos && state.todos.length > 0) {
          console.log(`[DEBUG] Tentative de sauvegarde de ${state.todos.length} tâches avant déconnexion`);
          
          // Pour chaque tâche, vérifier si elle a un ID et tenter de la sauvegarder
          for (const todo of state.todos) {
            try {
              // Si la tâche a un ID (déjà sauvegardée précédemment)
              if (todo._id || todo.id) {
                console.log(`[DEBUG] Mise à jour de la tâche ${todo._id || todo.id} avant déconnexion`);
                await axios.put(`/todos/${todo._id || todo.id}`, todo);
              } else {
                // Si la tâche n'a pas d'ID (nouvelle tâche non sauvegardée)
                console.log(`[DEBUG] Sauvegarde d'une nouvelle tâche avant déconnexion`);
                await axios.post('/todos', todo);
              }
            } catch (saveError) {
              console.error(`[DEBUG] Erreur lors de la sauvegarde de tâche avant déconnexion:`, saveError);
              // Continuer avec les autres tâches même si celle-ci échoue
            }
          }
        }
        
        // Appeler l'API de déconnexion
        await axios.get('/auth/logout');
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      } finally {
        // Même en cas d'erreur, on nettoie les données côté client
        commit('LOGOUT');
      }
    },
    
    // Action pour vérifier l'authentification au chargement de l'application
    async checkAuth({ commit, dispatch }) {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        commit('LOGOUT');
        return { success: false };
      }
      
      try {
        // Configuration du token pour la requête
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        
        // Récupérer les informations de l'utilisateur
        const { data } = await axios.get('/auth/me');
        
        if (data.success && data.user) {
          // Sauvegarde de l'ancien utilisateur pour comparaison
          const oldUser = JSON.parse(localStorage.getItem('user'));
          const oldUserId = oldUser?.id;
          const newUserId = data.user.id;
          
          // Définir l'utilisateur actuel
          commit('SET_USER', data.user);
          commit('SET_AUTHENTICATED', true);
          
          // Vérifier s'il y a eu changement d'utilisateur
          if (oldUserId && oldUserId !== newUserId) {
            console.log(`[DEBUG] Changement d'utilisateur détecté: ${oldUserId} -> ${newUserId}`);
            // Nettoyer le localStorage des tâches de l'ancien utilisateur
            await dispatch('cleanStorageOnLogin');
          }
          
          // AMÉLIORATION: Synchroniser automatiquement les tâches au chargement
          try {
            console.log('[SYNC] Synchronisation automatique des tâches au chargement...');
            await dispatch('forceSyncToServer');
            console.log('[SYNC] Synchronisation automatique terminée');
          } catch (syncError) {
            console.error('[SYNC] Erreur lors de la synchronisation automatique:', syncError);
          }
          
          return { success: true };
        } else {
          commit('LOGOUT');
          return { success: false };
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        commit('LOGOUT');
        return { success: false };
      }
    },
    
    // Nouvelle action pour nettoyer le localStorage lors de la connexion
    async cleanStorageOnLogin({ commit, state }) {
      console.log('[DEBUG] Nettoyage du localStorage après changement d\'utilisateur');
      
      // Récupérer les tâches existantes
      const savedTodos = localStorage.getItem(STORAGE_KEY);
      if (!savedTodos) {
        console.log('[DEBUG] Aucune tâche à nettoyer dans le localStorage');
        return;
      }
      
      try {
        // Parser les tâches existantes
        const existingTodos = JSON.parse(savedTodos);
        if (!Array.isArray(existingTodos) || existingTodos.length === 0) {
          console.log('[DEBUG] Aucune tâche valide à nettoyer');
          return;
        }
        
        // Filtrer pour ne garder que les tâches de l'utilisateur actuel
        const userId = state.user?.id;
        if (!userId) {
          console.warn('[DEBUG] Pas d\'utilisateur connecté pour le filtrage');
          return;
        }
        
        const filteredTodos = existingTodos.filter(todo => todo.userId === userId);
        console.log(`[DEBUG] Nettoyage: ${filteredTodos.length}/${existingTodos.length} tâches conservées`);
        
        // Sauvegarder les tâches filtrées (même si c'est un tableau vide)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTodos));
        
        // Mettre à jour le state avec les tâches filtrées
        commit('SET_TODOS', filteredTodos);
        
        // Forcer la récupération des tâches depuis le serveur
        dispatch('fetchTodos');
        
      } catch (error) {
        console.error('[DEBUG] Erreur lors du nettoyage du localStorage:', error);
      }
    },
    // Nouvelle action pour forcer la synchronisation des tâches locales vers le serveur
    async forceSyncToServer({ commit, dispatch, state }, todos = null) {
      console.log('[DEBUG] Démarrage de la synchronisation forcée des tâches locales vers le serveur');
      
      // Utiliser les tâches fournies ou celles du state
      const todosToSync = todos || state.todos;
      
      if (!Array.isArray(todosToSync) || todosToSync.length === 0) {
        console.log('[DEBUG] Pas de tâches à synchroniser');
        return { success: true, message: 'Aucune tâche à synchroniser', count: 0 };
      }
      
      commit('SET_EMERGENCY_SYNC_IN_PROGRESS', true);
      
      try {
        // Assurons-nous que l'utilisateur est authentifié
        if (!state.isAuthenticated || !state.user) {
          return { 
            success: false, 
            error: 'Vous devez être connecté pour synchroniser vos tâches',
            count: 0
          };
        }
        
        // Pour chaque tâche, tenter de la synchroniser avec le serveur
        let successCount = 0;
        let errorCount = 0;
        const syncedTodos = [];
        
        for (const todo of todosToSync) {
          try {
            // S'assurer que la tâche a l'ID de l'utilisateur
            const todoWithUserId = { ...todo };
            if (!todoWithUserId.userId) {
              todoWithUserId.userId = state.user.id;
              console.log(`[DEBUG] Ajout de l'ID utilisateur ${state.user.id} à la tâche "${todo.title}"`);
            }
            
            // Si la tâche a un ID, essayer de la mettre à jour d'abord
            if (todo.id || todo._id) {
              try {
                console.log(`[DEBUG] Tentative de mise à jour de la tâche existante "${todo.title}" (ID: ${todo.id || todo._id})`);
                const { data } = await axios.put(`/todos/${todo.id || todo._id}`, todoWithUserId);
                syncedTodos.push(data);
                successCount++;
                console.log(`[DEBUG] Mise à jour réussie pour la tâche "${todo.title}"`);
                continue; // Passer à la tâche suivante si la mise à jour a réussi
              } catch (updateError) {
                // Si l'erreur est 404 (tâche non trouvée), essayer de créer une nouvelle tâche
                if (updateError.response && updateError.response.status === 404) {
                  console.log(`[DEBUG] Tâche non trouvée sur le serveur (ID: ${todo.id || todo._id}), tentative de création`);
                  // Continuer au code ci-dessous pour créer une nouvelle tâche
                } else {
                  // Pour les autres erreurs, les propager
                  throw updateError;
                }
              }
            }
            
            // Créer une nouvelle tâche
            console.log(`[DEBUG] Création d'une nouvelle tâche "${todo.title}"`);
            // Supprimer tout ID potentiellement présent pour éviter les erreurs "id must be unique"
            const todoToCreate = { ...todoWithUserId };
            if (todoToCreate.id) delete todoToCreate.id;
            if (todoToCreate._id) delete todoToCreate._id;
            
            const { data } = await axios.post('/todos', todoToCreate);
            syncedTodos.push(data);
            successCount++;
            console.log(`[DEBUG] Création réussie pour la tâche "${todo.title}" avec nouvel ID ${data.id || data._id}`);
          } catch (error) {
            console.error(`[DEBUG] Erreur lors de la synchronisation de la tâche "${todo.title}":`, error);
            errorCount++;
          }
        }
        
        console.log(`[DEBUG] Force sauvegarde des tâches existantes: ${successCount}`);
        
        // Si des tâches ont été synchronisées, mettre à jour le state
        if (syncedTodos.length > 0) {
          commit('SET_TODOS', syncedTodos);
          
          // Sauvegarder dans le localStorage
          const saveSuccess = saveTodosToStorage(syncedTodos);
          console.log(`[DEBUG] Force sauvegarde ${saveSuccess ? 'réussie' : 'échouée'}`);
          
          // Vérification de la sauvegarde
          const savedData = localStorage.getItem('todos');
          console.log(`[DEBUG] Vérification après force sauvegarde: ${savedData ? savedData.length : 0} caractères`);
        }
        
        // Afficher un message de statut
        commit('SET_NOTIFICATION_STATUS', {
          success: successCount > 0,
          message: `Synchronisation: ${successCount} tâches synchronisées, ${errorCount} échouées`
        });
        
        return { 
          success: successCount > 0, 
          data: syncedTodos,
          message: `${successCount} tâches synchronisées, ${errorCount} échouées`,
          count: successCount
        };
      } catch (error) {
        console.error('[DEBUG] Erreur globale lors de la synchronisation forcée:', error);
        
        commit('SET_NOTIFICATION_STATUS', {
          success: false,
          message: 'Erreur lors de la synchronisation forcée'
        });
        
        return { success: false, error: error.message, count: 0 };
      } finally {
        commit('SET_EMERGENCY_SYNC_IN_PROGRESS', false);
      }
    },
    
    // NOUVELLE ACTION: Synchronisation automatique au démarrage
    async autoSyncOnStartup({ commit, dispatch, state }) {
      console.log('[DEBUG] Démarrage de la synchronisation automatique');
      
      // Si l'utilisateur est connecté, forcer le chargement depuis la base de données
      if (state.isAuthenticated && state.useDatabase) {
        console.log('[DEBUG] Utilisateur connecté, synchronisation depuis la base de données');
        try {
          await dispatch('fetchTodos');
          console.log('[DEBUG] Synchronisation automatique réussie');
          return { success: true, message: 'Données synchronisées depuis la base de données' };
        } catch (error) {
          console.error('[DEBUG] Erreur lors de la synchronisation automatique:', error);
          return { success: false, error: error.message };
        }
      } else {
        console.log('[DEBUG] Utilisateur non connecté, utilisation du localStorage uniquement');
        try {
          await dispatch('fetchTodos');
          console.log('[DEBUG] Chargement local réussi');
          return { success: true, message: 'Données chargées depuis le stockage local' };
        } catch (error) {
          console.error('[DEBUG] Erreur lors du chargement local:', error);
          return { success: false, error: error.message };
        }
      }
    }
  }
}) 