const router = require('express').Router();
const Todo = require('../models/Todo');

router.get('/', async (req, res) => {
  console.log('GET /todos - début');
  try {
    // Vérifier la connexion MongoDB
    if (!Todo.db.readyState) {
      console.error('MongoDB not connected');
      return res.status(500).json({ error: 'Database not connected' });
    }

    const todos = await Todo.find().sort({ createdAt: -1 });
    console.log('GET /todos - succès:', todos.length, 'todos trouvés');
    res.json(todos);
  } catch (error) {
    console.error('GET /todos - erreur:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post('/', async (req, res) => {
  console.log('POST /todos - début');
  console.log('Body reçu:', req.body);
  
  try {
    if (!req.body || !req.body.title) {
      console.log('POST /todos - body invalide');
      return res.status(400).json({ error: 'Title is required' });
    }

    const todo = new Todo({
      title: req.body.title,
      dueDate: req.body.dueDate,
      dueTime: req.body.dueTime,
      category: req.body.category || 'autre',
      completed: false
    });

    const savedTodo = await todo.save();
    console.log('POST /todos - succès:', savedTodo);
    res.json(savedTodo);
  } catch (error) {
    console.error('POST /todos - erreur:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

router.put('/:id', async (req, res) => {
  console.log('PUT /todos/:id - début', req.params.id, req.body);
  try {
    const todo = await Todo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (todo) {
      console.log('PUT /todos/:id - succès:', todo);
      res.json(todo);
    } else {
      res.status(404).json({ error: 'Todo not found' });
    }
  } catch (error) {
    console.error('PUT /todos/:id - erreur:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

router.delete('/:id', async (req, res) => {
  console.log('DELETE /todos/:id - début', req.params.id);
  try {
    const todo = await Todo.findByIdAndDelete(req.params.id);
    console.log('DELETE /todos/:id - succès:', todo);
    res.json({ success: !!todo });
  } catch (error) {
    console.error('DELETE /todos/:id - erreur:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

module.exports = router; 