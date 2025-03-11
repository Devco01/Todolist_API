# TodoList App - Thème Forêt Enchantée

Une application moderne de gestion de tâches construite avec Vue.js et Express.js, avec un thème visuel inspiré de l'univers de Mushishi.

## Technologies

- Frontend : Vue.js, Vuex, Vue Router
- Backend : Express.js, MongoDB
- Déploiement : Vercel


## Thème visuel

Le design de l'application s'inspire de l'esthétique de Mushishi, avec :
- Une palette de couleurs vertes et dorées évoquant une forêt baignée de lumière
- Des effets de flou (backdrop-filter) pour créer une atmosphère éthérée
- Des éléments semi-transparents qui se fondent harmonieusement avec l'arrière-plan
- Des animations subtiles pour une expérience utilisateur fluide et agréable

## Fonctionnalités

- ✅ Création, modification et suppression de tâches
- 🔍 Recherche et filtrage des tâches
- 🔄 Tri par date d'échéance, priorité, titre ou date de création
- 🎨 Interface utilisateur moderne et responsive
- 📱 Compatible mobile et desktop
- 🌈 Catégorisation des tâches avec codes couleur
- ⏰ Gestion des dates et heures d'échéance
- 🚨 Indicateur pour les tâches urgentes (< 24h)

## Technologies utilisées

### Frontend
- Vue.js 3 (Composition API)
- Vuex pour la gestion d'état
- Vue Router
- Axios pour les requêtes HTTP
- CSS moderne avec variables, transitions et backdrop-filter

### Backend
- Express.js
- MongoDB avec Mongoose
- API RESTful
- Validation des données

## Installation

### Prérequis
- Node.js (v14+)
- MongoDB

### Étapes d'installation

1. Cloner le dépôt
```bash
git clone https://github.com/votre-utilisateur/todolist-app.git
cd todolist-app
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env
# Modifier le fichier .env avec vos propres valeurs
```

4. Ajouter l'image de fond
```bash
# Placer l'image mushishi_wallpaper.jpeg dans le dossier public
```

5. Lancer l'application en développement
```bash
# Lancer le serveur backend
npm run dev:server

# Lancer le frontend
npm run dev:client

# Ou lancer les deux simultanément
npm run dev
```

## Structure du projet

```
├── api/                  # Backend Express
│   ├── config/           # Configuration (DB, etc.)
│   ├── models/           # Modèles Mongoose
│   ├── routes/           # Routes API
│   └── server.js         # Point d'entrée du serveur
├── public/               # Fichiers statiques
│   └── mushishi_wallpaper.jpeg  # Image de fond
├── src/                  # Frontend Vue.js
│   ├── components/       # Composants Vue
│   ├── router/           # Configuration des routes
│   ├── store/            # Store Vuex
│   ├── utils/            # Utilitaires
│   ├── views/            # Pages/Vues
│   ├── App.vue           # Composant racine
│   └── main.js           # Point d'entrée
├── .env.example          # Exemple de variables d'environnement
├── package.json          # Dépendances et scripts
└── README.md             # Documentation
```

