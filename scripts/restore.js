#!/usr/bin/env node
/**
 * Family Tree Database Restore Script
 * 
 * Usage:
 *   node scripts/restore.js backups/backup-2026-04-30_12-00-00.sql
 * 
 * Restores the database from a backup file.
 * WARNING: This will overwrite all current data!
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

const DB_NAME    = process.env.DB_NAME    || 'familytree';
const DB_USER    = process.env.DB_USER    || 'familytree_user';
const DB_HOST    = process.env.DB_HOST    || 'localhost';
const DB_PORT    = process.env.DB_PORT    || '5432';
const DB_PASSWORD = process.env.DB_PASSWORD || 'familytree123';

const backupFile = process.argv[2];

if (!backupFile) {
  console.error('Usage: node scripts/restore.js <backup-file>');
  console.error('Example: node scripts/restore.js backups/backup-2026-04-30_12-00-00.sql');
  process.exit(1);
}

const filepath = path.resolve(backupFile);

if (!fs.existsSync(filepath)) {
  console.error(`❌ Backup file not found: ${filepath}`);
  process.exit(1);
}

console.log(`⚠️  WARNING: This will overwrite all data in '${DB_NAME}'!`);
console.log(`Restoring from: ${filepath}`);
console.log('');

try {
  // Drop all tables and restore
  const restoreCmd = `psql -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} -f "${filepath}"`;
  execSync(restoreCmd, {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD },
    stdio: 'inherit'
  });
  console.log('');
  console.log(`✅ Database restored successfully from ${path.basename(filepath)}`);
} catch (err) {
  console.error('❌ Restore failed:', err.message);
  process.exit(1);
}
