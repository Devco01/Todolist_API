const express = require('express');
const router = express.Router();
const todoStore = require('../store/todoStore');

router.get('/', (req, res) => {
  res.json(todoStore.getAll());
});

router.post('/', (req, res) => {
  const todo = todoStore.add(req.body);
  res.status(201).json(todo);
});

router.delete('/:id', (req, res) => {
  todoStore.delete(req.params.id);
  res.status(200).json({ message: 'Todo supprimée' });
});

router.put('/:id', (req, res) => {
  const todo = todoStore.update(req.params.id, req.body);
  if (todo) {
    res.json(todo);
  } else {
    res.status(404).json({ message: 'Todo non trouvée' });
  }
});

module.exports = router; 