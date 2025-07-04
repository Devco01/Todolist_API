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
    
    <!-- Bouton menu mobile -->
    <button 
      class="mobile-menu-btn"
      @click="toggleMobileMenu"
      :class="{ active: showMobileMenu }"
      aria-label="Menu"
    >
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
      <span class="hamburger-line"></span>
    </button>
    
    <div class="navbar-menu" :class="{ active: showMobileMenu }">
      <!-- Afficher si l'utilisateur est connecté -->
      <template v-if="isAuthenticated">
        <div class="user-info">
          <div class="user-avatar">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
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
        <router-link to="/login" class="navbar-item" @click="closeMobileMenu">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
            <polyline points="10 17 15 12 10 7"></polyline>
            <line x1="15" y1="12" x2="3" y2="12"></line>
          </svg>
          <span>Connexion</span>
        </router-link>
        <router-link to="/register" class="navbar-item" @click="closeMobileMenu">
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
    
    <!-- Overlay pour fermer le menu mobile -->
    <div 
      v-if="showMobileMenu" 
      class="mobile-overlay"
      @click="closeMobileMenu"
    ></div>
  </nav>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  name: 'NavBar',
  data() {
    return {
      showMobileMenu: false
    }
  },
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
      this.closeMobileMenu();
      this.$router.push('/login');
    },
    toggleMobileMenu() {
      this.showMobileMenu = !this.showMobileMenu;
    },
    closeMobileMenu() {
      this.showMobileMenu = false;
    }
  },
  mounted() {
    // Fermer le menu mobile lors du redimensionnement
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.closeMobileMenu();
      }
    });
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

.navbar-brand {
  z-index: 1001;
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

.mobile-menu-btn {
  display: none;
  flex-direction: column;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: none;
  border: none;
  cursor: pointer;
  z-index: 1001;
  padding: 8px;
  border-radius: 6px;
  transition: var(--transition);
}

.mobile-menu-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.hamburger-line {
  width: 24px;
  height: 3px;
  background-color: white;
  margin: 2px 0;
  transition: 0.3s;
  border-radius: 2px;
}

.mobile-menu-btn.active .hamburger-line:nth-child(1) {
  transform: rotate(-45deg) translate(-5px, 6px);
}

.mobile-menu-btn.active .hamburger-line:nth-child(2) {
  opacity: 0;
}

.mobile-menu-btn.active .hamburger-line:nth-child(3) {
  transform: rotate(45deg) translate(-5px, -6px);
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

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4a373, #e9c46a);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.user-avatar svg {
  width: 18px;
  height: 18px;
  color: white;
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

.mobile-overlay {
  display: none;
}

/* Responsive Mobile */
@media (max-width: 768px) {
  .navbar {
    padding: 1rem 1.25rem;
  }
  
  .brand-link {
    font-size: 1.25rem;
  }
  
  .brand-icon {
    width: 24px;
    height: 24px;
  }
  
  .mobile-menu-btn {
    display: flex;
  }
  
  .navbar-menu {
    position: fixed;
    top: 0;
    right: -100%;
    width: 280px;
    height: 100vh;
    background: linear-gradient(180deg, #4a7c59, #2c5530);
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    padding: 6rem 1.5rem 2rem;
    gap: 1rem;
    transition: right 0.3s ease;
    z-index: 1000;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  }
  
  .navbar-menu.active {
    right: 0;
  }
  
  .user-info {
    flex-direction: column;
    text-align: center;
    padding: 1.5rem 1rem;
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    margin-bottom: 1rem;
  }
  
  .user-avatar {
    width: 48px;
    height: 48px;
    margin-bottom: 0.75rem;
  }
  
  .user-avatar svg {
    width: 24px;
    height: 24px;
  }
  
  .welcome {
    font-size: 1rem;
    font-weight: 600;
  }
  
  .navbar-item {
    width: 100%;
    padding: 1rem 1.25rem;
    margin-bottom: 0.5rem;
    border-radius: 12px;
    font-size: 1rem;
    justify-content: flex-start;
    background-color: rgba(255, 255, 255, 0.05);
    border: 2px solid rgba(255, 255, 255, 0.1);
  }
  
  .navbar-item:hover {
    background-color: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateX(4px);
  }
  
  .navbar-item svg {
    width: 20px;
    height: 20px;
  }
  
  .logout-btn {
    width: 100%;
    padding: 1rem 1.25rem;
    margin-top: 1rem;
    font-size: 1rem;
    justify-content: center;
    border-radius: 12px;
  }
  
  .logout-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .mobile-overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
    backdrop-filter: blur(2px);
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
  
  .mobile-menu-btn {
    width: 40px;
    height: 40px;
  }
  
  .hamburger-line {
    width: 20px;
    height: 2px;
  }
  
  .navbar-menu {
    width: 100%;
    right: -100%;
    padding: 5rem 1rem 2rem;
  }
  
  .user-info {
    padding: 1.25rem 0.875rem;
  }
  
  .navbar-item {
    padding: 0.875rem 1rem;
    font-size: 0.95rem;
  }
  
  .logout-btn {
    padding: 0.875rem 1rem;
    font-size: 0.95rem;
  }
}

/* Animations supplémentaires */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.navbar-menu.active {
  animation: slideInRight 0.3s ease-out;
}
</style> 