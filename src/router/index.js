import { createRouter, createWebHistory } from 'vue-router'
import TodoList from '../views/TodoList.vue'
import Login from '../components/Login.vue'
import Register from '../components/Register.vue'
import store from '../store'

const routes = [
  {
    path: '/',
    name: 'TodoList',
    component: TodoList,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { guest: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation guard pour protéger les routes
router.beforeEach(async (to, from, next) => {
  // Vérifier si l'utilisateur est authentifié au chargement de la page
  const isLoggedIn = store.state.isAuthenticated;
  
  // Si la route requiert une authentification et que l'utilisateur n'est pas connecté
  if (to.matched.some(record => record.meta.requiresAuth) && !isLoggedIn) {
    // Rediriger vers la page de connexion
    next({ name: 'Login' });
  } 
  // Si la route est pour invités et que l'utilisateur est déjà connecté
  else if (to.matched.some(record => record.meta.guest) && isLoggedIn) {
    // Rediriger vers la page d'accueil
    next({ name: 'TodoList' });
  } 
  // Sinon, continuer normalement
  else {
    next();
  }
});

export default router 