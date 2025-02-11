const router = require('express').Router();
const todoStore = require('../store/todoStore');

router.get('/', async (req, res) => {
  console.log('GET /todos - début');
  try {
    const todos = await todoStore.getAll();
    console.log('GET /todos - résultat:', todos);
    res.json(todos);
  } catch (error) {
    console.error('GET /todos - erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/', async (req, res) => {
  console.log('POST /todos - données:', req.body);
  try {
    const todo = await todoStore.add(req.body);
    console.log('POST /todos - résultat:', todo);
    res.json(todo);
  } catch (error) {
    console.error('POST /todos - erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
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