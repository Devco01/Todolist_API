<template>
  <div class="register-container">
    <div class="auth-form">
      <h2>Inscription</h2>
      <div v-if="error" class="error-message">{{ error }}</div>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">Nom d'utilisateur</label>
          <input 
            type="text" 
            id="username" 
            v-model="username" 
            required
          />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            v-model="email" 
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
            minlength="6"
          />
          <small>Le mot de passe doit contenir au moins 6 caractères</small>
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirmer le mot de passe</label>
          <input 
            type="password" 
            id="confirmPassword" 
            v-model="confirmPassword" 
            required
          />
        </div>
        <div class="form-actions">
          <button type="submit" :disabled="loading || !isFormValid">
            {{ loading ? 'Inscription en cours...' : 'S\'inscrire' }}
          </button>
          <p>
            Déjà inscrit ? 
            <router-link to="/login">Se connecter</router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script>
import axios from '../utils/axios';

export default {
  name: 'RegisterView',
  data() {
    return {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      loading: false,
      error: null
    }
  },
  computed: {
    isFormValid() {
      return (
        this.username && 
        this.email && 
        this.password && 
        this.confirmPassword && 
        this.password === this.confirmPassword &&
        this.password.length >= 6
      );
    }
  },
  methods: {
    async handleRegister() {
      // Vérifier que les mots de passe correspondent
      if (this.password !== this.confirmPassword) {
        this.error = 'Les mots de passe ne correspondent pas';
        return;
      }
      
      this.loading = true;
      this.error = null;
      
      try {
        console.log('Envoi des données d\'inscription:', {
          username: this.username,
          email: this.email,
          password: '***MASQUÉ***'
        });
        
        // Envoyer la requête d'inscription
        const { data } = await axios.post('/auth/register', {
          username: this.username,
          email: this.email,
          password: this.password
        });
        
        console.log('Réponse d\'inscription reçue:', data);
        
        // Stocker le token dans le localStorage
        localStorage.setItem('authToken', data.token);
        
        // Stocker les informations utilisateur dans le store
        this.$store.commit('SET_USER', data.user);
        this.$store.commit('SET_AUTHENTICATED', true);
        
        // Rediriger vers la page d'accueil
        this.$router.push('/');
      } catch (error) {
        console.error('Détails de l\'erreur d\'inscription:', error);
        
        let errorMessage = 'Erreur lors de l\'inscription';
        
        // Récupérer le message d'erreur détaillé
        if (error.response) {
          console.error('Réponse d\'erreur du serveur:', error.response.data);
          errorMessage = error.response.data.message || 
                        `Erreur serveur: ${error.response.status} ${error.response.statusText}`;
        } else if (error.request) {
          errorMessage = 'Le serveur n\'a pas répondu à la requête';
          console.error('Aucune réponse reçue:', error.request);
        } else {
          errorMessage = error.message;
        }
        
        this.error = errorMessage;
        console.error('Erreur d\'inscription:', error);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<style scoped>
.register-container {
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

small {
  display: block;
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.8rem;
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
  background-color: #f8d7da;
  color: #721c24;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border-radius: 4px;
  text-align: center;
}
</style> 