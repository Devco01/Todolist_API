const express = require('express');
const app = express();

// Juste le healthcheck
app.get('/test', (req, res) => res.sendStatus(200));

// Middleware minimal
app.use(express.json());

// Routes de base
app.get('/', (req, res) => res.send('OK'));
app.use('/api/todos', require('./src/routes/todoRoutes'));

// Export
module.exports = app; 