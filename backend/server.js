const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Routes API
app.use('/api/todos', require('./src/routes/todoRoutes'));

// Route racine - doit être la première route
app.get('/', function(req, res) {
  res.status(200).send(`
    <html>
      <head>
        <title>TodoList API</title>
      </head>
      <body>
        <h1>TodoList API</h1>
        <p>Status: Running</p>
        <h2>Available Endpoints:</h2>
        <ul>
          <li><code>/api/todos</code> - Todo operations</li>
        </ul>
      </body>
    </html>
  `);
});

// Catch-all route pour le 404
app.use('*', (req, res) => {
  console.log('404 for:', req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
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