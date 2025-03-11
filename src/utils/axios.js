import axios from 'axios';

// Déterminer l'URL de l'API en fonction de l'environnement
const apiUrl = import.meta.env.VITE_API_URL || '/api';

// Créer une instance axios avec la configuration de base
const instance = axios.create({
  baseURL: apiUrl,
  timeout: 30000,  // 30 secondes
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour gérer les erreurs de connexion
instance.interceptors.response.use(
  response => response,
  error => {
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
          const newTodo = {
            ...data,
            _id: Math.random().toString(36).substring(2, 15),
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
    }
    
    return Promise.reject(error);
  }
);

export default instance; 