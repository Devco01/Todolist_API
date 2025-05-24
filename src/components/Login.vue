<template>
  <div class="login-container">
    <div class="auth-form">
      <h2>Connexion</h2>
      <div v-if="error" class="error-message">{{ error }}</div>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="username">Nom d'utilisateur ou Email</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            required
          />
        </div>
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input 
            type="password" 
            id="password" 
            v-model="password" 
            required
          />
        </div>
        <div class="form-actions">
          <button type="submit" :disabled="loading">
            {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
          </button>
          <p>
            Pas encore inscrit ? 
            <router-link to="/register">Créer un compte</router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import axios from '../utils/axios';

export default {
  name: 'LoginView',
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      error: null
    }
  },
  methods: {
    async handleLogin() {
      this.loading = true;
      this.error = null;
      
      try {
        // Envoyer la requête de connexion
        const { data } = await axios.post('/auth/login', {
          username: this.username,
          password: this.password
        });
        
        // Stocker le token dans le localStorage
        localStorage.setItem('authToken', data.token);
        
        // Stocker les informations utilisateur dans le store
        this.$store.commit('SET_USER', data.user);
        this.$store.commit('SET_AUTHENTICATED', true);
        
        // Déclencher la synchronisation des tâches après la connexion
        this.synchronizeTodos();
        
        // Rediriger vers la page d'accueil
        this.$router.push('/');
      } catch (error) {
        this.error = error.response?.data?.message || 'Erreur lors de la connexion';
        console.error('Erreur de connexion:', error);
      } finally {
        this.loading = false;
      }
    },
    
    // Nouvelle méthode pour synchroniser les tâches après connexion
    async synchronizeTodos() {
      console.log('[SYNC] Synchronisation des tâches après connexion...');
      
      try {
        // Récupérer les tâches du serveur et les fusionner avec les tâches locales
        const result = await this.$store.dispatch('fetchTodos');
        
        if (result.success) {
          console.log(`[SYNC] Synchronisation réussie, ${result.data?.length || 0} tâches disponibles`);
        } else {
          console.error('[SYNC] Échec de la synchronisation des tâches:', result.error);
        }
      } catch (error) {
        console.error('[SYNC] Erreur lors de la synchronisation des tâches:', error);
      }
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
}

.auth-form {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: #4a7c59;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-actions {
  margin-top: 2rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background-color: #4a7c59;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #3a6c49;
}

button:disabled {
  background-color: #88a990;
  cursor: not-allowed;
}

p {
  text-align: center;
  margin-top: 1rem;
}

a {
  color: #4a7c59;
  text-decoration: none;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}
</style> 