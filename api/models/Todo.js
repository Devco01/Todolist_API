// Fichier factice pour éviter les erreurs d'importation
console.log('Modèle Todo (MongoDB) désactivé. Utilisation de TodoPg à la place.');

// Modèle factice qui ne fait rien
const todoSchema = {};
const Todo = {
  find: async () => [],
  findById: async () => null,
  create: async () => ({ _id: 'factice' }),
  findByIdAndUpdate: async () => null,
  findByIdAndDelete: async () => null
};

module.exports = Todo; 