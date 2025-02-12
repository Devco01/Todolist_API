# TodoList API

Une application de gestion de tâches avec Vue.js et MongoDB.

## Installation

```bash
# Installation des dépendances
npm install

# Configuration
cp .env.example .env
# Modifier .env avec vos variables d'environnement

# Développement
npm run dev:all

# Production
npm run build
npm run serve
```

## Variables d'environnement

- `MONGODB_URI` : URI de connexion MongoDB
- `PORT` : Port du serveur (défaut: 3000)
- `VITE_API_URL` : URL de l'API (défaut: /api)

## Technologies

- Frontend : Vue.js, Vuex, Vue Router
- Backend : Express.js, MongoDB
- Déploiement : Vercel