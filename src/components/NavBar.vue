<template>
  <nav class="navbar">
    <div class="navbar-brand">
      <router-link to="/">TodoList</router-link>
    </div>
    <div class="navbar-menu">
      <!-- Afficher si l'utilisateur est connecté -->
      <template v-if="isAuthenticated">
        <span class="welcome">Bonjour, {{ username }}</span>
        <button @click="handleLogout" class="logout-btn">Déconnexion</button>
      </template>
      <!-- Afficher si l'utilisateur n'est pas connecté -->
      <template v-else>
        <router-link to="/login" class="navbar-item">Connexion</router-link>
        <router-link to="/register" class="navbar-item">Inscription</router-link>
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
  background-color: #4a7c59;
  color: white;
}

.navbar-brand a {
  color: white;
  font-size: 1.5rem;
  font-weight: bold;
  text-decoration: none;
}

.navbar-menu {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.navbar-item {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.navbar-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.logout-btn {
  background-color: #3a6c49;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.logout-btn:hover {
  background-color: #305a3a;
}

.welcome {
  font-size: 0.9rem;
  margin-right: 1rem;
}
</style> 