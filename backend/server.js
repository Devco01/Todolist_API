const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Route racine en premier
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head><title>TodoList API</title></head>
      <body>
        <h1>TodoList API</h1>
        <p>Status: Running</p>
      </body>
    </html>
  `);
});

// API routes
app.use('/api/todos', require('./src/routes/todoRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server Error' });
});

// Démarrage explicite du serveur
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('=== Server Error ===', err);
});

module.exports = app; 