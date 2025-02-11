# Todolist API

Une API de liste de tâches personnalisée avec MongoDB et Express.js

## Technologies utilisées

- Node.js
- Express.js
- MongoDB
- Mongoose
- Cors
- Dotenv

## Installation

1. Cloner le projet
```bash
git clone https://github.com/Devco01/Todolist_API.git
cd Todolist_API/backend
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
Créer un fichier `.env` dans le dossier backend avec :
```
MONGODB_URI=votre_uri_mongodb
PORT=3000
```

4. Lancer le serveur
```bash
npm run dev
```

## Endpoints API

- `GET /api/todos` - Récupérer toutes les tâches
- `POST /api/todos` - Créer une nouvelle tâche
- `PUT /api/todos/:id` - Mettre à jour une tâche
- `DELETE /api/todos/:id` - Supprimer une tâche

## Structure des données

Une tâche contient :
- title (obligatoire)
- description
- completed (par défaut: false)
- priority (basse, moyenne, haute)
- category (maison, courses, santé, famille, autre)
- dueDate
- createdAt

## Déploiement

L'API est configurée pour être déployée sur Vercel.