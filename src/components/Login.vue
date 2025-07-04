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
        // Étape 1: D'abord forcer la synchronisation des tâches locales vers le serveur
        await this.$store.dispatch('forceSyncToServer');
        
        // Étape 2: Récupérer les tâches du serveur après la synchronisation
        const result = await this.$store.dispatch('fetchTodos');
        
        if (result.success) {
          console.log(`[SYNC] Synchronisation automatique réussie, ${result.data?.length || 0} tâches disponibles`);
          
          // Notification de succès
          this.$store.commit('SET_NOTIFICATION_STATUS', {
            success: true,
            message: 'Vos tâches ont été synchronisées avec succès'
          });
        } else {
          console.error('[SYNC] Échec de la synchronisation des tâches:', result.error);
          
          // Notification d'échec discrète
          this.$store.commit('SET_NOTIFICATION_STATUS', {
            success: false,
            message: 'Impossible de synchroniser certaines tâches'
          });
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
  padding: 2rem 1rem;
}

.auth-form {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: var(--overlay-light);
  border-radius: 12px;
  box-shadow: var(--box-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

h2 {
  text-align: center;
  margin-bottom: 2rem;
  color: var(--primary);
  font-weight: 700;
  font-size: 1.75rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

/* Pictogramme supprimé */

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: var(--dark);
  font-size: 0.95rem;
}

input {
  width: 100%;
  padding: 0.875rem;
  border: 2px solid var(--gray-light);
  border-radius: 8px;
  font-size: 1rem;
  transition: var(--transition);
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.15);
  outline: none;
  background-color: white;
}

input:valid {
  border-color: var(--success);
}

.form-actions {
  margin-top: 2rem;
}

button {
  width: 100%;
  padding: 1rem;
  background: linear-gradient(135deg, var(--primary), var(--success));
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition);
  min-height: 48px;
  box-shadow: 0 4px 12px rgba(74, 124, 89, 0.3);
  position: relative;
  overflow: hidden;
}

button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

button:hover::before {
  left: 100%;
}

button:hover {
  background: linear-gradient(135deg, var(--secondary), var(--primary));
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(74, 124, 89, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(74, 124, 89, 0.3);
}

button:disabled {
  background: linear-gradient(135deg, var(--gray-light), var(--gray));
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

button:disabled::before {
  display: none;
}

p {
  text-align: center;
  margin-top: 1.5rem;
  color: var(--dark);
  font-size: 0.95rem;
}

a {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  transition: var(--transition);
  border-bottom: 2px solid transparent;
}

a:hover {
  color: var(--secondary);
  border-bottom-color: var(--primary);
}

.error-message {
  background: linear-gradient(135deg, #ffebee, #ffcdd2);
  color: var(--danger);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  border: 2px solid rgba(188, 71, 73, 0.2);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(188, 71, 73, 0.1);
}

.error-message::before {
  content: '⚠️';
  font-size: 1.25rem;
  flex-shrink: 0;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .login-container {
    min-height: calc(100vh - 80px);
    padding: 1rem 0.75rem;
    align-items: flex-start;
    padding-top: 2rem;
  }
  
  .auth-form {
    padding: 1.75rem 1.5rem;
    border-radius: 12px;
    max-width: none;
    width: 100%;
    margin: 0 auto;
  }
  
  h2 {
    font-size: 1.5rem;
    margin-bottom: 1.75rem;
    gap: 0.5rem;
  }
  
  h2::before {
    font-size: 1.25rem;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  label {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
  
  input {
    padding: 1rem;
    font-size: 16px; /* Évite le zoom sur iOS */
    border-radius: 8px;
    border-width: 2px;
  }
  
  input:focus {
    box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.2);
  }
  
  button {
    padding: 1.125rem;
    font-size: 1rem;
    min-height: 52px;
    border-radius: 10px;
  }
  
  .error-message {
    padding: 0.875rem;
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
  
  p {
    font-size: 0.9rem;
    margin-top: 1.25rem;
  }
}

/* Mobile très petit */
@media (max-width: 480px) {
  .login-container {
    padding: 0.75rem 0.5rem;
    padding-top: 1.5rem;
  }
  
  .auth-form {
    padding: 1.5rem 1.25rem;
    border-radius: 10px;
  }
  
  h2 {
    font-size: 1.375rem;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1.125rem;
  }
  
  label {
    font-size: 0.85rem;
  }
  
  input {
    padding: 0.875rem;
    font-size: 16px;
  }
  
  button {
    padding: 1rem;
    font-size: 0.95rem;
    min-height: 48px;
  }
  
  .error-message {
    padding: 0.75rem;
    font-size: 0.85rem;
    gap: 0.5rem;
  }
  
  .error-message::before {
    font-size: 1.125rem;
  }
  
  p {
    font-size: 0.85rem;
    margin-top: 1rem;
  }
}

/* Mobile paysage */
@media (max-width: 768px) and (orientation: landscape) {
  .login-container {
    min-height: calc(100vh - 60px);
    padding-top: 1rem;
  }
  
  .auth-form {
    padding: 1.25rem 1.5rem;
  }
  
  h2 {
    font-size: 1.25rem;
    margin-bottom: 1.25rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-actions {
    margin-top: 1.5rem;
  }
}

/* Améliorations accessibilité */
@media (max-width: 768px) {
  /* Focus visible amélioré */
  input:focus,
  button:focus,
  a:focus {
    outline: 3px solid rgba(74, 124, 89, 0.3);
    outline-offset: 2px;
  }
  
  /* Amélioration du contraste */
  label {
    text-shadow: 0 1px 2px rgba(255, 255, 255, 0.5);
  }
  
  /* Zones tactiles optimisées */
  input {
    min-height: 48px;
    touch-action: manipulation;
  }
  
  button {
    touch-action: manipulation;
  }
  
  a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0;
  }
}

/* Animations d'entrée */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-form {
  animation: slideIn 0.5s ease-out;
}

/* États de chargement - spinner supprimé pour cohérence */
button:disabled {
  position: relative;
}
</style> 