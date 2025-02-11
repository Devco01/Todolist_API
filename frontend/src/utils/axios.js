import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://todolist-api-seven.vercel.app/api'
  : 'http://localhost:3000/api';

const instance = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour les erreurs
instance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 404) {
      console.error('Resource not found:', error.config.url);
    } else {
      console.error('API Error:', {
        status: error.response?.status,
        message: error.message,
        url: error.config?.url
      });
    }
    return Promise.reject(error);
  }
);

// Intercepteur pour les requêtes
instance.interceptors.request.use(
  config => {
    config.headers = {
      ...config.headers,
      'Content-Type': 'application/json'
    };
    return config;
  }
);

export default instance; 