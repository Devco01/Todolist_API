const express = require('express');
const app = express();

// Logs détaillés pour debug
console.log('=== Server Startup ===');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  PWD: process.env.PWD
});

// Error handler
app.use((err, req, res, next) => {
  console.error('=== Error ===');
  console.error(err);
  res.status(500).send('Server Error');
});

// Healthcheck avec logs
app.all('*', (req, res) => {
  console.log('=== Request Received ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  res.status(200).send('OK');
});

// Démarrage explicite du serveur
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=== Server Started on port ${PORT} ===`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('=== Server Error ===', err);
});

module.exports = app; 