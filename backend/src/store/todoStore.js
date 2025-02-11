// Store simple en mémoire
let todos = [];
let nextId = 1;

const todoStore = {
  getAll: () => todos,
  
  add: (todo) => {
    const newTodo = { ...todo, _id: String(nextId++), createdAt: new Date() };
    todos.unshift(newTodo);
    return newTodo;
  },
  
  delete: (id) => {
    todos = todos.filter(todo => todo._id !== id);
    return true;
  },
  
  update: (id, updates) => {
    const index = todos.findIndex(todo => todo._id === id);
    if (index !== -1) {
      todos[index] = { ...todos[index], ...updates };
      return todos[index];
    }
    return null;
  }
};

module.exports = todoStore; 