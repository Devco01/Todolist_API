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
        
        // Déclencher la synchronisation des tâches après l'inscription
        this.synchronizeTodos();
        
        // Rediriger vers la page d'accueil
        this.$router.push('/');
      } catch (error) {
        this.error = error.response?.data?.message || 'Erreur lors de l\'inscription';
        console.error('Erreur d\'inscription:', error);
      } finally {
        this.loading = false;
      }
    },
    // Nouvelle méthode pour synchroniser les tâches après inscription
    async synchronizeTodos() {
      console.log('[SYNC] Synchronisation des tâches après inscription...');
      
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
.register-container {
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

input:invalid:not(:placeholder-shown) {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px rgba(188, 71, 73, 0.1);
}

small {
  display: block;
  margin-top: 0.5rem;
  color: var(--gray);
  font-size: 0.85rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

small::before {
  content: 'ℹ️';
  font-size: 0.9rem;
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
  .register-container {
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
  
  small {
    font-size: 0.8rem;
    margin-top: 0.375rem;
  }
  
  small::before {
    font-size: 0.85rem;
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
  .register-container {
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
  
  small {
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  small::before {
    font-size: 0.8rem;
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
  .register-container {
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

/* Validations visuelles */
.form-group.valid input {
  border-color: var(--success);
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3e%3cpath fill='%23198754' d='m2.3 6.73.94-.94 2.94 2.94c.39-.39.39-1.04 0-1.44L3.84 4.95 6.2 2.6c.39-.39.39-1.04 0-1.44-.39-.39-1.04-.39-1.44 0L2.3 3.62.86 2.18c-.39-.39-1.04-.39-1.44 0-.39.39-.39 1.04 0 1.44l1.44 1.44-1.44 1.44c-.39.39-.39 1.04 0 1.44.39.39 1.04.39 1.44 0z'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem 1rem;
  padding-right: 2.5rem;
}

.form-group.invalid input {
  border-color: var(--danger);
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' stroke='%23dc3545' viewBox='0 0 12 12'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath d='m6 3v4m0 2h.01'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 1rem 1rem;
  padding-right: 2.5rem;
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

/* États de chargement - spinner supprimé pour éviter les boucles infinies */
button:disabled {
  position: relative;
}

/* Indicateur de force du mot de passe */
.password-strength {
  margin-top: 0.5rem;
  height: 4px;
  background-color: var(--gray-light);
  border-radius: 2px;
  overflow: hidden;
}

.password-strength-bar {
  height: 100%;
  transition: var(--transition);
  border-radius: 2px;
}

.password-strength.weak .password-strength-bar {
  width: 33%;
  background-color: var(--danger);
}

.password-strength.medium .password-strength-bar {
  width: 66%;
  background-color: #ffa500;
}

.password-strength.strong .password-strength-bar {
  width: 100%;
  background-color: var(--success);
}
</style> 