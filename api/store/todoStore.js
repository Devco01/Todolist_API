const { put, get, del } = require('@vercel/blob');

let todos = [];
let nextId = 1;

const BLOB_NAME = 'todos-data.json';

const todoStore = {
  getAll: async () => {
    try {
      const blob = await get(BLOB_NAME);
      if (blob) {
        const data = JSON.parse(await blob.text());
        todos = data.todos || [];
        nextId = data.nextId || 1;
      }
      return todos || [];
    } catch (error) {
      console.error('Error getting todos:', error);
      return [];
    }
  },
  
  add: async (todo) => {
    try {
      const newTodo = { 
        ...todo, 
        _id: String(nextId++), 
        createdAt: new Date(),
        completed: false
      };
      todos = [newTodo, ...todos];
      await put(BLOB_NAME, JSON.stringify({ todos, nextId }), {
        access: 'public',
        addRandomSuffix: false
      });
      return newTodo;
    } catch (error) {
      console.error('Error adding todo:', error);
      return null;
    }
  },
  
  delete: async (id) => {
    try {
      const initialLength = todos.length;
      todos = todos.filter(todo => todo._id !== id);
      await put(BLOB_NAME, JSON.stringify({ todos, nextId }), {
        access: 'public',
        addRandomSuffix: false
      });
      return { success: todos.length < initialLength };
    } catch (error) {
      console.error('Error deleting todo:', error);
      return { success: false };
    }
  },
  
  update: async (id, updates) => {
    try {
      const index = todos.findIndex(todo => todo._id === id);
      if (index !== -1) {
        todos[index] = { ...todos[index], ...updates };
        await put(BLOB_NAME, JSON.stringify({ todos, nextId }), {
          access: 'public',
          addRandomSuffix: false
        });
        return todos[index];
      }
      return null;
    } catch (error) {
      console.error('Error updating todo:', error);
      return null;
    }
  }
};

module.exports = todoStore; 