import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://todolist-api-seven.vercel.app/api'  // URL de l'API sur Vercel
  : 'http://localhost:3000/api';                  // URL de développement

const instance = axios.create({
  baseURL,
  withCredentials: false,  // Désactivé pour éviter les problèmes de cookies
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Ajouter un timeout
  timeout: 10000
});

// Intercepteur pour les erreurs
instance.interceptors.response.use(
  response => response,
  error => {
    console.error('Erreur API:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

export default instance; 