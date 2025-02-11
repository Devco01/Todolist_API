const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const Todo = require('../models/todo');

// Routes CRUD
router.get('/', todoController.getAllTodos);
router.post('/', todoController.createTodo);
router.put('/:id', todoController.updateTodo);
router.delete('/:id', todoController.deleteTodo);

module.exports = router; 