import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://todolist-api-seven.vercel.app/api'  // URL de l'API sur Vercel
  : 'http://localhost:3000/api';                  // URL de développement

const instance = axios.create({
  baseURL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

export default instance; 