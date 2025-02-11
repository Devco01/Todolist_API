import axios from 'axios';

const baseURL = import.meta.env.PROD 
  ? 'https://todolistapi-production-0e04.up.railway.app/api'
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