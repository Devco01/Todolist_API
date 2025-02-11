FROM node:18-alpine

WORKDIR /app

# Installation de wget pour le healthcheck
RUN apk add --no-cache wget

# Copier uniquement le backend
COPY backend/package*.json ./
RUN npm install

COPY backend ./

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Exposition du port
EXPOSE 3000

# Healthcheck plus simple
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/test', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Démarrage avec attente de MongoDB
CMD ["node", "server.js"] 