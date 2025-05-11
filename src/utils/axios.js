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

// Fonction de nettoyage local pour les erreurs 404
const handleLocalDelete = (id) => {
  try {
    console.log('[AXIOS] Tentative de suppression locale pour ID:', id);
    // Récupérer les todos du localStorage
    let localTodos = JSON.parse(localStorage.getItem('todos') || '[]');
    const initialCount = localTodos.length;
    
    // Filtrer la tâche avec l'ID spécifié
    localTodos = localTodos.filter(t => {
      const todoId = t._id || t.id;
      return todoId !== id && String(todoId) !== String(id);
    });
    
    // Si une tâche a été supprimée, mettre à jour le localStorage
    if (localTodos.length < initialCount) {
      console.log('[AXIOS] Tâche supprimée localement avec succès');
      localStorage.setItem('todos', JSON.stringify(localTodos));
      return true;
    }
    
    console.log('[AXIOS] Aucune tâche locale trouvée avec cet ID');
    return false;
  } catch (error) {
    console.error('[AXIOS] Erreur lors de la suppression locale:', error);
    return false;
  }
};

// Intercepteur pour gérer les erreurs de connexion
instance.interceptors.response.use(
  response => {
    console.log(`[AXIOS] Réponse reçue: ${response.status} ${response.statusText} pour ${response.config.url}`);
    
    // Vérifier si un nouveau token a été fourni dans l'en-tête de réponse
    const newToken = response.headers['x-auth-token'];
    if (newToken) {
      console.log('[AXIOS] Nouveau token reçu, mise à jour du localStorage');
      // Mettre à jour le token dans le localStorage
      localStorage.setItem('authToken', newToken);
      // Mettre à jour le token dans les en-têtes par défaut
      instance.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    }
    
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
    
    // IMPORTANT: Ne pas déconnecter l'utilisateur pour les erreurs 400 (validation)
    if (error.response && error.response.status === 400) {
      console.warn('[AXIOS] Erreur de validation 400 détectée, ne pas déconnecter');
      // Simplement laisser l'erreur remonter pour être traitée par le composant
      return Promise.reject(error);
    }
    
    // Gérer les erreurs d'authentification (401)
    if (error.response && error.response.status === 401) {
      // Vérifier si l'erreur vient d'une route autre que l'authentification ou la modification de données
      const url = error.config?.url || '';
      
      // Détecter si l'utilisateur n'existe plus
      const userNotFound = error.response.data?.details === 'user_not_found' || 
                          error.response.data?.forceLogout === true;
      
      // Si l'utilisateur n'existe plus, on force la déconnexion
      if (userNotFound) {
        console.warn('[AXIOS] Utilisateur non trouvé dans la base de données - forcer la déconnexion');
        
        // Nettoyer les données d'authentification
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Afficher un message à l'utilisateur
        if (window.dispatchEvent) {
          try {
            window.dispatchEvent(new CustomEvent('force-logout', { 
              detail: { 
                message: 'Votre compte utilisateur semble ne plus exister. Veuillez vous reconnecter.',
                reason: 'user_not_found'
              } 
            }));
          } catch (e) {
            console.error('[AXIOS] Erreur lors du dispatch d\'événement:', e);
          }
        }
        
        // Rediriger vers la page de connexion
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?error=session_expired';
        }
        
        return Promise.reject({
          ...error,
          handled: true,
          forced_logout: true,
          message: 'Session invalide - utilisateur non trouvé'
        });
      }
      
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
    
    // Gérer spécifiquement les erreurs 404 pour la suppression de tâches
    if (error.response && 
        error.response.status === 404 && 
        error.config.url.includes('/todos/') && 
        error.config.method.toLowerCase() === 'delete') {
      
      console.warn('[AXIOS] Tâche non trouvée en base de données lors de la suppression');
      
      // Extraire l'ID de la tâche à partir de l'URL
      const taskId = error.config.url.split('/').pop();
      
      // Tenter de supprimer localement
      const deleted = handleLocalDelete(taskId);
      
      if (deleted) {
        console.log('[AXIOS] Suppression locale réussie, renvoi d\'une réponse simulée');
        return Promise.resolve({
          data: {
            success: true,
            message: 'Tâche supprimée localement uniquement'
          }
        });
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
          const index = localTodos.findIndex(t => t._id === id || t.id === id);
          if (index !== -1) {
            localTodos[index] = { ...localTodos[index], ...data };
            localStorage.setItem('todos', JSON.stringify(localTodos));
            return Promise.resolve({ data: localTodos[index] });
          }
        }
        else if (method === 'delete') {
          const id = url.split('/').pop();
          localTodos = localTodos.filter(t => t._id !== id && t.id !== id);
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
    
    // Pour les erreurs 405 Method Not Allowed, vérifier si c'est une requête PUT sur les tâches
    if (error.response && error.response.status === 405) {
      const url = error.config?.url || '';
      const method = error.config?.method?.toLowerCase() || '';
      
      console.log(`[AXIOS] Erreur 405 détectée pour ${method} sur ${url}`);
      
      // Tenter d'utiliser POST à la place de PUT si c'est une opération sur les tâches
      if ((method === 'put' || method === 'patch') && url.includes('/todos/')) {
        console.log('[AXIOS] Tentative de conversion PUT → POST pour résoudre l\'erreur 405');
        
        // Extraire l'ID de la tâche
        const taskId = url.split('/').pop();
        const data = error.config.data ? JSON.parse(error.config.data) : {};
        
        // Ajouter l'ID à l'objet de données
        data.id = taskId;
        
        // Créer une nouvelle requête POST
        return axios.post('/todos', data)
          .then(response => {
            console.log('[AXIOS] Conversion PUT → POST réussie');
            return response;
          })
          .catch(postError => {
            console.error('[AXIOS] Échec de la conversion PUT → POST:', postError);
            return Promise.reject(error); // Rejeter l'erreur originale si la conversion échoue
          });
      }
    }
    
    // Pour les autres types d'erreurs, les remonter avec plus d'infos
    console.error(`Erreur API: ${error.response?.status} ${error.response?.statusText || error.message}`);
    return Promise.reject(error);
  }
);

export default instance; 