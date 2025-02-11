const router = require('express').Router();
const todoStore = require('../store/todoStore');

router.get('/', (req, res) => {
  console.log('GET /todos');
  res.json(todoStore.getAll());
});

router.post('/', (req, res) => {
  console.log('POST /todos', req.body);
  const todo = todoStore.add(req.body);
  res.json(todo);
});

router.put('/:id', (req, res) => {
  console.log('PUT /todos/:id', req.params.id, req.body);
  const todo = todoStore.update(req.params.id, req.body);
  if (todo) {
    res.json(todo);
  } else {
    res.status(404).json({ error: 'Todo not found' });
  }
});

router.delete('/:id', (req, res) => {
  console.log('DELETE /todos/:id', req.params.id);
  const result = todoStore.delete(req.params.id);
  res.json({ success: result });
});

module.exports = router; 