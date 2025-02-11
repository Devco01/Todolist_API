import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://todolist-api-seven.vercel.app/api'  // URL de l'API sur Vercel
  : 'http://localhost:3000/api';                  // URL de développement

const instance = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

export default instance; 