/**
 * Script de vérification des contraintes/index sur les tables User et Todo
 * 
 * Ce script permet de détecter rapidement si des contraintes/index doublons
 * sont en train de se recréer (problème qu'on a eu avec 6000+ index).
 * 
 * Usage: node scripts/check-constraints.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { getSequelize, connectPostgres } = require('../api/config/postgres');

async function checkConstraints() {
  try {
    console.log('🔍 Vérification des contraintes/index...\n');
    
    // Connexion à la DB
    let sequelize = getSequelize();
    if (!sequelize) {
      const connected = await connectPostgres();
      if (!connected) {
        console.error('❌ Impossible de se connecter à PostgreSQL');
        process.exit(1);
      }
      sequelize = getSequelize();
    }
    
    // Vérifier les contraintes UNIQUE sur User
    const [userConstraints] = await sequelize.query(`
      SELECT 
        conname AS constraint_name,
        pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
      FROM pg_constraint c
      JOIN pg_index i ON c.conindid = i.indexrelid
      WHERE conrelid = 'public."User"'::regclass
        AND contype = 'u'
      ORDER BY conname;
    `);
    
    // Vérifier les index sur User
    const [userIndexes] = await sequelize.query(`
      SELECT 
        COUNT(*) AS total_indexes,
        pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_size
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname='User';
    `);
    
    console.log('📊 TABLE User:');
    console.log(`   - Contraintes UNIQUE: ${userConstraints.length}`);
    console.log(`   - Index totaux: ${userIndexes[0].total_indexes}`);
    console.log(`   - Taille totale des index: ${userIndexes[0].total_size}`);
    
    // Alerte si trop de contraintes
    if (userConstraints.length > 5) {
      console.log('\n⚠️  ALERTE: Plus de 5 contraintes UNIQUE sur User !');
      console.log('   Cela peut indiquer un problème de recréation de contraintes.');
      console.log('   Contraintes trouvées:');
      userConstraints.slice(0, 10).forEach(c => {
        console.log(`     - ${c.constraint_name} (${c.index_size})`);
      });
      if (userConstraints.length > 10) {
        console.log(`     ... et ${userConstraints.length - 10} autres`);
      }
    } else {
      console.log('   ✅ Nombre de contraintes normal');
    }
    
    // Vérifier les index sur Todo
    const [todoIndexes] = await sequelize.query(`
      SELECT 
        COUNT(*) AS total_indexes,
        pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_size
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname='public' AND t.relname='Todo';
    `);
    
    console.log('\n📊 TABLE Todo:');
    console.log(`   - Index totaux: ${todoIndexes[0].total_indexes}`);
    console.log(`   - Taille totale des index: ${todoIndexes[0].total_size}`);
    
    // Vérifier la taille totale de la DB
    const [dbSize] = await sequelize.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;
    `);
    
    console.log('\n💾 BASE DE DONNÉES:');
    console.log(`   - Taille totale: ${dbSize[0].db_size}`);
    
    // Alerte si la taille des index User est anormale (> 1 MB)
    const userIndexSizeBytes = parseInt(userIndexes[0].total_size.replace(/[^0-9]/g, ''));
    if (userIndexSizeBytes > 1024 * 1024) { // > 1 MB
      console.log('\n⚠️  ALERTE: La taille des index User est anormalement élevée !');
      console.log('   Cela peut indiquer un problème de bloat/index doublons.');
    }
    
    console.log('\n✅ Vérification terminée');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
    process.exit(1);
  }
}

checkConstraints();
