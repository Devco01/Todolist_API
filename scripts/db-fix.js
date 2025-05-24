// Script pour réparer la base de données et migrer les données locales vers PostgreSQL
require('dotenv').config();
const { connectPostgres, getSequelize } = require('../api/config/postgres');
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

console.log('=============================================');
console.log('RÉPARATION DE LA BASE DE DONNÉES POSTGRESQL');
console.log('=============================================');

// Vérifier les variables d'environnement
console.log('Vérification des variables d\'environnement:');
const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
console.log('- URL PostgreSQL:', pgUrl ? 'Définie' : 'Non définie');

if (!pgUrl) {
  console.error('ERREUR: URL PostgreSQL non définie dans les variables d\'environnement');
  console.error('Veuillez définir POSTGRES_URL ou DATABASE_URL dans le fichier .env');
  process.exit(1);
}

// Fonction principale
async function main() {
  try {
    // 1. Connexion à PostgreSQL
    console.log('Tentative de connexion à PostgreSQL...');
    const connection = await connectPostgres();
    
    if (!connection) {
      throw new Error('Échec de connexion à PostgreSQL');
    }
    
    console.log('Connexion à PostgreSQL établie avec succès');
    
    const sequelize = getSequelize();
    
    // 2. Vérification des tables existantes
    console.log('Vérification des tables existantes...');
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables existantes:', tables.map(t => t.table_name).join(', ') || 'Aucune');
    
    // 3. Vérification si la table Todo existe
    const todoTableExists = tables.some(t => t.table_name === 'Todo');
    console.log('Table Todo existe:', todoTableExists ? 'Oui' : 'Non');
    
    // 4. Si la table Todo existe, la supprimer pour la recréer proprement
    if (todoTableExists) {
      console.log('Suppression de la table Todo existante...');
      await sequelize.query('DROP TABLE IF EXISTS "Todo" CASCADE');
      console.log('Table Todo supprimée avec succès');
    }
    
    // 5. Créer la table Todo
    console.log('Création de la table Todo...');
    
    // Ajuster la requête de création de table pour qu'elle fonctionne même sans la table User
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Todo" (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          "dueDate" DATE,
          "dueTime" VARCHAR(255),
          category VARCHAR(255) DEFAULT 'autre',
          priority VARCHAR(255) DEFAULT 'medium',
          completed BOOLEAN DEFAULT false,
          "notificationEmail" VARCHAR(255),
          "notificationsEnabled" BOOLEAN DEFAULT false,
          "notificationSent" BOOLEAN DEFAULT false,
          "userId" VARCHAR(255),
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      console.log('Table Todo créée avec succès');
    } catch (createError) {
      console.error('Erreur lors de la création de la table Todo:', createError);
      
      // Tentative alternative sans contrainte de clé étrangère
      console.log('Tentative alternative de création de la table Todo...');
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "Todo" (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          "dueDate" VARCHAR(255),
          "dueTime" VARCHAR(255),
          category VARCHAR(255),
          priority VARCHAR(255),
          completed BOOLEAN DEFAULT false,
          "notificationEmail" VARCHAR(255),
          "notificationsEnabled" BOOLEAN DEFAULT false,
          "notificationSent" BOOLEAN DEFAULT false,
          "userId" VARCHAR(255),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      console.log('Table Todo créée avec la méthode alternative');
    }
    
    // 6. Récupérer les todos depuis le fichier local JSON s'il existe
    console.log('Recherche des tâches locales à migrer...');
    let localTodos = [];
    
    // Essayer d'abord le fichier todos-data.json
    const todosDataPath = path.join(__dirname, '../todos-data.json');
    if (fs.existsSync(todosDataPath)) {
      try {
        const todosData = JSON.parse(fs.readFileSync(todosDataPath, 'utf8'));
        if (todosData && todosData.todos && Array.isArray(todosData.todos)) {
          localTodos = todosData.todos;
          console.log(`${localTodos.length} tâches trouvées dans todos-data.json`);
        }
      } catch (error) {
        console.error('Erreur lors de la lecture de todos-data.json:', error);
      }
    } else {
      console.log('Fichier todos-data.json non trouvé');
    }
    
    // Si aucune tâche trouvée, demander à l'utilisateur de coller le contenu JSON
    if (localTodos.length === 0) {
      console.log('\n=============================================');
      console.log('AUCUNE TÂCHE TROUVÉE AUTOMATIQUEMENT');
      console.log('=============================================');
      console.log('Pour migrer vos tâches locales, veuillez:');
      console.log('1. Ouvrir la console de votre navigateur dans l\'application');
      console.log('2. Exécuter: localStorage.getItem("todos")');
      console.log('3. Copier le résultat JSON');
      console.log('4. Créer un fichier nommé local-todos.json à la racine du projet');
      console.log('5. Coller le contenu JSON dans ce fichier');
      console.log('6. Relancer ce script');
      console.log('=============================================\n');
      
      // Vérifier si un fichier local-todos.json existe déjà
      const localTodosPath = path.join(__dirname, '../local-todos.json');
      if (fs.existsSync(localTodosPath)) {
        try {
          const todosJson = fs.readFileSync(localTodosPath, 'utf8');
          localTodos = JSON.parse(todosJson);
          console.log(`${localTodos.length} tâches trouvées dans local-todos.json`);
        } catch (error) {
          console.error('Erreur lors de la lecture de local-todos.json:', error);
        }
      }
    }
    
    // 7. Insérer les todos dans la base de données
    if (localTodos.length > 0) {
      console.log(`Migration de ${localTodos.length} tâches vers PostgreSQL...`);
      
      for (const todo of localTodos) {
        try {
          // Préparer la requête d'insertion
          const columns = Object.keys(todo)
            .filter(key => key !== '_id' && todo[key] !== undefined)
            .map(key => `"${key}"`);
          
          const values = Object.keys(todo)
            .filter(key => key !== '_id' && todo[key] !== undefined)
            .map(key => {
              const value = todo[key];
              if (value === null) return 'NULL';
              if (typeof value === 'boolean') return value ? 'true' : 'false';
              return `'${String(value).replace(/'/g, "''")}'`;
            });
          
          // Si id n'est pas dans les colonnes, l'ajouter
          if (!columns.includes('"id"')) {
            columns.push('"id"');
            values.push(todo._id ? `'${todo._id}'` : todo.id ? `'${todo.id}'` : 'DEFAULT');
          }
          
          // S'assurer que createdAt et updatedAt sont inclus
          if (!columns.includes('"createdAt"')) {
            columns.push('"createdAt"');
            values.push(`NOW()`);
          }
          
          if (!columns.includes('"updatedAt"')) {
            columns.push('"updatedAt"');
            values.push(`NOW()`);
          }
          
          const query = `
            INSERT INTO "Todo" (${columns.join(', ')})
            VALUES (${values.join(', ')})
            ON CONFLICT (id) DO UPDATE
            SET ${columns.map((col, i) => `${col} = ${values[i]}`).join(', ')}
          `;
          
          await sequelize.query(query);
          console.log(`Tâche "${todo.title}" migrée avec succès`);
        } catch (insertError) {
          console.error(`Erreur lors de la migration de la tâche "${todo.title}":`, insertError);
        }
      }
      
      console.log('Migration des tâches terminée');
    } else {
      console.log('Aucune tâche à migrer');
    }
    
    // 8. Vérifier les tâches dans la base de données
    console.log('Vérification des tâches dans la base de données...');
    const [dbTodos] = await sequelize.query('SELECT * FROM "Todo"');
    
    console.log(`${dbTodos.length} tâches trouvées dans la base de données PostgreSQL`);
    
    if (dbTodos.length > 0) {
      console.log('Premières tâches dans la base de données:');
      dbTodos.slice(0, 3).forEach(todo => {
        console.log(`- ${todo.title} (ID: ${todo.id}, Date: ${todo.dueDate})`);
      });
    }
    
    console.log('\n=============================================');
    console.log('RÉPARATION DE LA BASE DE DONNÉES TERMINÉE');
    console.log('=============================================');
    console.log('Résumé:');
    console.log(`- ${localTodos.length} tâches trouvées localement`);
    console.log(`- ${dbTodos.length} tâches présentes dans PostgreSQL`);
    console.log('=============================================');
    
  } catch (error) {
    console.error('Erreur lors de la réparation de la base de données:', error);
  } finally {
    process.exit(0);
  }
}

// Exécuter le script
main(); 