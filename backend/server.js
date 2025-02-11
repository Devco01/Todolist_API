const express = require('express');
const app = express();

// Logs détaillés pour debug
console.log('=== Server Startup ===');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  PWD: process.env.PWD,
  PATH: process.env.PATH
});

// Healthcheck avec logs
app.all('*', (req, res) => {
  console.log('=== Request Received ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  
  res.status(200).send('OK');
});

// Démarrage explicite du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=== Server Started ===`);
  console.log(`Listening on port ${PORT}`);
  console.log('Ready for connections');
});

module.exports = app; 