import axios from 'axios';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,  // 30 secondes
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for debugging
instance.interceptors.request.use(request => {
  console.log('Starting Request', request)
  return request
})

// Add response interceptor for debugging
instance.interceptors.response.use(response => {
  console.log('Response:', response)
  return response
}, error => {
  console.error('API Error:', error)
  return Promise.reject(error)
})

export default instance; 