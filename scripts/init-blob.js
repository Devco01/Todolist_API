const { put } = require('@vercel/blob');
require('dotenv').config({ path: '.env.local' });

async function initBlob() {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    console.log('Token:', token); // Pour déboguer

    const initialData = {
      todos: [],
      nextId: 1
    };

    const { url } = await put('todos-data.json', JSON.stringify(initialData), {
      access: 'public',
      addRandomSuffix: false,
      token: token // Passer explicitement le token
    });

    console.log('Blob initialized successfully!');
    console.log('URL:', url);
  } catch (error) {
    console.error('Error initializing blob:', error);
    console.error('Error details:', error.message);
  }
}

initBlob(); 