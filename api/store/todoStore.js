const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'todos.json');

// Charger les données au démarrage
let todos = [];
let nextId = 1;

try {
  if (fs.existsSync(DATA_FILE)) {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    todos = data.todos || [];
    nextId = data.nextId || 1;
  }
} catch (error) {
  console.error('Error loading from file:', error);
}

// Sauvegarder les données
const saveToFile = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ todos, nextId }, null, 2));
  } catch (error) {
    console.error('Error saving to file:', error);
  }
};

const todoStore = {
  getAll: () => {
    console.log('Current todos:', todos);
    return todos;
  },
  
  add: (todo) => {
    console.log('Adding todo:', todo);
    const newTodo = { 
      ...todo, 
      _id: String(nextId++), 
      createdAt: new Date(),
      completed: false
    };
    todos.unshift(newTodo);
    saveToFile();
    return newTodo;
  },
  
  delete: (id) => {
    console.log('Deleting todo:', id);
    const initialLength = todos.length;
    todos = todos.filter(todo => todo._id !== id);
    saveToFile();
    return { success: todos.length < initialLength };
  },
  
  update: (id, updates) => {
    console.log('Updating todo:', id, updates);
    const index = todos.findIndex(todo => todo._id === id);
    if (index !== -1) {
      todos[index] = { ...todos[index], ...updates };
      saveToFile();
      return todos[index];
    }
    return null;
  }
};

module.exports = todoStore; 