import pool from './pool';
import fs from 'fs';
import path from 'path';

async function resetDatabase() {
  console.log('🚀 Starting database reset...');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Drop all tables
    // We can use a query to drop all tables in the public schema
    console.log('🗑️ Dropping all existing tables...');
    await client.query(`
      DROP TABLE IF EXISTS pokes CASCADE;
      DROP TABLE IF EXISTS events CASCADE;
      DROP TABLE IF EXISTS partnerships CASCADE;
      DROP TABLE IF EXISTS refresh_tokens CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // 2. Read and execute schema.sql
    console.log('📜 Re-applying schema.sql...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schemaSql);

    await client.query('COMMIT');
    console.log('✅ Database reset successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error resetting database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetDatabase();
