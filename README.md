# TodoList API - Thème Forêt Enchantée

Application de gestion de tâches avec design inspiré de Mushishi, combinant fonctionnalités modernes et interface élégante.


## Fonctionnalités

- ✅ Gestion complète des tâches (création, modification, suppression)
- 🔄 Tri et filtrage avancés (date, priorité, catégorie)
- 📱 Interface responsive et adaptative
- 🔔 Notifications par email automatiques
- 💾 Sauvegarde locale des tâches (fonctionne hors connexion)
- 🎨 Thème visuel inspiré de forêts mystiques


## Notifications par email

Un **cron** s’exécute **tous les jours à 8 h** (heure de Paris) : s’il existe des tâches avec date d’échéance = aujourd’hui, notifications activées et email renseigné, un rappel est envoyé par mail.

- **Sur Vercel** : configurer les variables d’environnement **SMTP** pour que les mails partent vraiment :
  - `SMTP_HOST` (ex. `smtp.gmail.com`)
  - `SMTP_USER`, `SMTP_PASS`
  - `EMAIL_FROM` (optionnel)
- Sans SMTP en production, le cron répond 503 et n’envoie rien.
- Heure d’envoi : **7 h UTC** = 8 h Paris (hiver). Variable optionnelle `NOTIFICATION_CRON_HOUR_UTC` (défaut `7`). `CRON_TZ` pour la date du jour (défaut `Europe/Paris`).

## Stack technique

- **Frontend**: Vue.js 3, Vuex, CSS moderne
- **Backend**: Express.js, MongoDB/Mongoose
- **Outils**: API RESTful, système de notification

Devco01 2025
