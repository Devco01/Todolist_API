import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://votre-app-railway-url.up.railway.app/api'  // Remplacez par l'URL fournie par Railway
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