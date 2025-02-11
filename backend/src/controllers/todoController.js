const Todo = require('../models/Todo');

exports.getAllTodos = async (req, res) => {
  try {
    const todos = await Todo.find().sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error('Erreur getAllTodos:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des todos',
      error: error.message 
    });
  }
};

exports.createTodo = async (req, res) => {
  try {
    console.log('Données reçues:', req.body);
    
    const todoData = {
      title: req.body.title,
      category: req.body.category,
      dueDate: req.body.dueDate || null,
      dueTime: req.body.dueTime || null,
      description: req.body.description || ''
    };

    const todo = new Todo(todoData);
    const newTodo = await todo.save();
    
    console.log('Todo créé:', newTodo);
    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Erreur createTodo:', error);
    res.status(400).json({ 
      message: 'Erreur lors de la création de la todo',
      error: error.message 
    });
  }
};

exports.updateTodo = async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (todo) {
      Object.assign(todo, req.body);
      const updatedTodo = await todo.save();
      res.json(updatedTodo);
    } else {
      res.status(404).json({ message: 'Tâche non trouvée' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (todo) {
      await todo.deleteOne();
      res.json({ message: 'Tâche supprimée' });
    } else {
      res.status(404).json({ message: 'Tâche non trouvée' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}; 