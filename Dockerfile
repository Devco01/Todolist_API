FROM node:18-alpine

WORKDIR /app

# Copier uniquement le backend
COPY backend/package*.json ./
RUN npm install

COPY backend ./

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Exposition du port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/test || exit 1

# Démarrage
CMD ["node", "server.js"] 