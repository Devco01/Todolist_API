import axios from 'axios';

// Déterminer l'URL de l'API en fonction de l'environnement
const apiUrl = import.meta.env.VITE_API_URL || '/api';
console.log('API URL configurée:', apiUrl);

// Créer une instance axios avec la configuration de base
const instance = axios.create({
  baseURL: apiUrl,
  timeout: 15000,  // 15 secondes
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour les requêtes
instance.interceptors.request.use(
  config => {
    // Ajouter le token JWT s'il existe
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    console.log(`[AXIOS] Requête ${config.method.toUpperCase()} vers ${config.url}`, 
      config.data ? `avec données: ${JSON.stringify(config.data).replace(/"password":"[^"]*"/g, '"password":"***MASQUÉ***"')}` : 'sans données');
    return config;
  },
  error => {
    console.error('[AXIOS] Erreur lors de la préparation de la requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs de connexion
instance.interceptors.response.use(
  response => {
    console.log(`[AXIOS] Réponse reçue: ${response.status} ${response.statusText} pour ${response.config.url}`);
    
    // Compatibilité PostgreSQL (id) et MongoDB (_id)
    if (response.data) {
      // Si on a un tableau de résultats
      if (Array.isArray(response.data)) {
        response.data.forEach(item => {
          if (item.id && !item._id) {
            item._id = item.id;
          }
        });
      } 
      // Si on a un seul objet
      else if (typeof response.data === 'object' && response.data.id && !response.data._id) {
        response.data._id = response.data.id;
      }
    }
    
    return response;
  },
  error => {
    // Afficher les détails de l'erreur
    if (error.response) {
      console.error(`[AXIOS] Erreur de réponse: ${error.response.status} ${error.response.statusText}`,
        'URL:', error.config?.url,
        'Données:', error.response.data);
    } else if (error.request) {
      console.error('[AXIOS] Erreur de requête - Aucune réponse reçue:', 
        'URL:', error.config?.url);
    } else {
      console.error('[AXIOS] Erreur:', error.message);
    }
    
    // Gérer les erreurs d'authentification (401)
    if (error.response && error.response.status === 401) {
      // Vérifier si l'erreur vient d'une route autre que l'authentification ou la modification de données
      const url = error.config?.url || '';
      
      // Mettre à jour la liste des routes sécurisées pour inclure tous les endpoints de modification
      const isSafeRoute = 
        url.includes('/todos') || 
        url.includes('/notifications') || 
        url.includes('/keep-alive') ||
        url.includes('/api/todos') ||
        url.includes('/api/notifications');
      
      if (!isSafeRoute) {
        console.warn('[AXIOS] Session expirée ou non authentifiée');
        // Nettoyer les données d'authentification
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Rediriger vers la page de connexion si nécessaire
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else {
        console.warn(`[AXIOS] Erreur 401 sur route sécurisée (${url}), ignorée pour éviter déconnexion automatique pendant modification des données`);
      }
    }
    
    // Si l'erreur est due à un problème de connexion au serveur
    if (!error.response) {
      console.warn('Erreur de connexion au serveur API. Utilisation du stockage local.');
      
      // Récupérer la requête originale
      const originalRequest = error.config;
      const url = originalRequest.url;
      const method = originalRequest.method;
      const data = originalRequest.data ? JSON.parse(originalRequest.data) : null;
      
      // Récupérer les todos du localStorage
      let localTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      
      // Traiter la requête en fonction de la méthode
      if (url.includes('/todos')) {
        if (method === 'get') {
          return Promise.resolve({ data: localTodos });
        }
        else if (method === 'post' && data) {
          const newId = Math.random().toString(36).substring(2, 15);
          const newTodo = {
            ...data,
            _id: newId,
            id: newId,
            createdAt: new Date().toISOString()
          };
          localTodos.unshift(newTodo);
          localStorage.setItem('todos', JSON.stringify(localTodos));
          return Promise.resolve({ data: newTodo });
        }
        else if ((method === 'put' || method === 'patch') && data) {
          const id = url.split('/').pop();
          const index = localTodos.findIndex(t => t._id === id);
          if (index !== -1) {
            localTodos[index] = { ...localTodos[index], ...data };
            localStorage.setItem('todos', JSON.stringify(localTodos));
            return Promise.resolve({ data: localTodos[index] });
          }
        }
        else if (method === 'delete') {
          const id = url.split('/').pop();
          localTodos = localTodos.filter(t => t._id !== id);
          localStorage.setItem('todos', JSON.stringify(localTodos));
          return Promise.resolve({ data: { success: true } });
        }
      }
      
      return Promise.reject({
        message: 'Erreur de connexion au serveur',
        offline: true,
        originalError: error
      });
    }
    
    // Gérer spécifiquement les erreurs 404 pour les tâches qui existent en localStorage mais pas en BD
    if (error.response && error.response.status === 404 && error.config.url.includes('/todos/')) {
      console.warn('[AXIOS] Tâche non trouvée en BD mais peut exister en localStorage, tentative de fallback');
      
      // Récupérer l'ID de la tâche
      const id = error.config.url.split('/').pop();
      
      // Récupérer les todos du localStorage
      let localTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      
      // Vérifier si la tâche existe en localStorage
      const method = error.config.method;
      
      if (method === 'delete') {
        // Pour la suppression, filtrer la tâche du localStorage
        const todoExists = localTodos.some(t => t._id === id || t.id === id);
        
        if (todoExists) {
          console.log('[AXIOS] Tâche trouvée en localStorage, suppression locale uniquement');
          localTodos = localTodos.filter(t => t._id !== id && t.id !== id);
          localStorage.setItem('todos', JSON.stringify(localTodos));
          return Promise.resolve({ data: { success: true, message: 'Tâche supprimée localement' } });
        }
      }
      
      // Pour les autres méthodes ou si la tâche n'existe pas en localStorage
      // On continue avec le rejet normal
    }
    
    // Pour les autres types d'erreurs, les remonter avec plus d'infos
    console.error(`Erreur API: ${error.response?.status} ${error.response?.statusText || error.message}`);
    return Promise.reject(error);
  }
);

export default instance; 