<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <router-link to="/" class="brand-link">
        <svg class="brand-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
        <span class="brand-text">TodoList</span>
      </router-link>
    </div>
    
    <div class="navbar-menu">
      <!-- Afficher si l'utilisateur est connecté -->
      <template v-if="isAuthenticated">
        <div class="user-info">
          <span class="welcome">Bonjour, {{ username }}</span>
        </div>
        <button @click="handleLogout" class="logout-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Déconnexion</span>
        </button>
      </template>
      <!-- Afficher si l'utilisateur n'est pas connecté -->
      <template v-else>
        <router-link to="/login" class="navbar-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Connexion</span>
        </router-link>
        <router-link to="/register" class="navbar-item">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="8.5" cy="7" r="4"></circle>
            <line x1="20" y1="8" x2="20" y2="14"></line>
            <line x1="23" y1="11" x2="17" y2="11"></line>
          </svg>
          <span>Inscription</span>
        </router-link>
      </template>
    </div>
  </nav>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  name: 'NavBar',
  computed: {
    ...mapState({
      isAuthenticated: state => state.isAuthenticated,
      user: state => state.user
    }),
    username() {
      return this.user ? this.user.username : '';
    }
  },
  methods: {
    ...mapActions(['logout']),
    async handleLogout() {
      await this.logout();
      this.$router.push('/login');
    }
  }
}
</script>

<style scoped>
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #4a7c59, #588157);
  color: white;
  position: relative;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
  transition: var(--transition);
}

.brand-link:hover {
  transform: translateY(-1px);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.brand-icon {
  width: 28px;
  height: 28px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
}

.brand-text {
  letter-spacing: 1px;
}

.navbar-menu {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.navbar-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: white;
  text-decoration: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  transition: var(--transition);
  font-weight: 500;
  border: 2px solid transparent;
}

.navbar-item:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-1px);
}

.navbar-item.router-link-active {
  background-color: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #bc4749, #d62d20);
  color: white;
  border: none;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: var(--transition);
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(188, 71, 73, 0.3);
}

.logout-btn:hover {
  background: linear-gradient(135deg, #a13638, #bc4749);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(188, 71, 73, 0.4);
}

.welcome {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .navbar {
    padding: 1rem 1.25rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  
  .brand-link {
    font-size: 1.25rem;
  }
  
  .brand-icon {
    width: 24px;
    height: 24px;
  }
  
  .navbar-menu {
    width: 100%;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .user-info {
    order: 1;
    width: 100%;
    justify-content: center;
    margin-bottom: 0.5rem;
  }
  
  .navbar-item {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    flex: 1;
    justify-content: center;
    min-width: 120px;
  }
  
  .logout-btn {
    padding: 0.5rem 0.75rem;
    font-size: 0.9rem;
    order: 2;
    width: 100%;
    justify-content: center;
  }
  
  .welcome {
    font-size: 0.85rem;
    text-align: center;
  }
}

/* Mobile très petit */
@media (max-width: 480px) {
  .navbar {
    padding: 0.875rem 1rem;
  }
  
  .brand-link {
    font-size: 1.125rem;
  }
  
  .brand-icon {
    width: 20px;
    height: 20px;
  }
  
  .navbar-item {
    padding: 0.625rem 0.75rem;
    font-size: 0.85rem;
    min-width: 100px;
  }
  
  .logout-btn {
    padding: 0.625rem 0.75rem;
    font-size: 0.85rem;
  }
  
  .welcome {
    font-size: 0.8rem;
  }
}
</style> 