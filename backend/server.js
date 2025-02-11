const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Simple test route
app.all('*', (req, res) => {
  res.status(200).json({
    status: 'ok',
    path: req.path,
    method: req.method
  });
});

module.exports = app; 