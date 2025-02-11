import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

const instance = axios.create({
  baseURL,
  timeout: 10000
});

export default instance; 