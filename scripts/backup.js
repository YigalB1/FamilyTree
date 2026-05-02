#!/usr/bin/env node
/**
 * Family Tree Database Backup Script
 * 
 * Usage:
 *   node scripts/backup.js
 * 
 * Creates a timestamped .sql dump in the backups/ folder.
 * Keeps last 30 days of backups, deletes older ones.
 * 
 * Schedule with Windows Task Scheduler to run daily.
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

// ── Config ────────────────────────────────────────────────────────
const DB_NAME    = process.env.DB_NAME    || 'familytree';
const DB_USER    = process.env.DB_USER    || 'familytree_user';
const DB_HOST    = process.env.DB_HOST    || 'localhost';
const DB_PORT    = process.env.DB_PORT    || '5432';
const KEEP_DAYS  = parseInt(process.env.KEEP_DAYS || '30');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// ── Create backups folder if it doesn't exist ─────────────────────
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`Created backups/ folder at ${BACKUP_DIR}`);
}

// ── Generate timestamp ────────────────────────────────────────────
const now       = new Date();
const timestamp = now.toISOString()
  .replace('T', '_')
  .replace(/:/g, '-')
  .split('.')[0];
const filename  = `backup-${timestamp}.sql`;
const filepath  = path.join(BACKUP_DIR, filename);

// ── Run pg_dump ───────────────────────────────────────────────────
console.log(`Starting backup: ${filename}`);
console.log(`Database: ${DB_NAME} @ ${DB_HOST}:${DB_PORT}`);

try {
  const pgDumpCmd = `pg_dump -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -F p -f "${filepath}" ${DB_NAME}`;
  
  // Set PGPASSWORD env var to avoid password prompt
  const dbPassword = process.env.DB_PASSWORD || 'familytree123';
  execSync(pgDumpCmd, {
    env: { ...process.env, PGPASSWORD: dbPassword },
    stdio: 'pipe'
  });

  const stats   = fs.statSync(filepath);
  const sizeMB  = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`✅ Backup created: ${filename} (${sizeMB} MB)`);
} catch (err) {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
}

// ── Clean up old backups ──────────────────────────────────────────
console.log(`Cleaning up backups older than ${KEEP_DAYS} days...`);

const files = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.startsWith('backup-') && f.endsWith('.sql'))
  .map(f => ({
    name: f,
    path: path.join(BACKUP_DIR, f),
    mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
  }))
  .sort((a, b) => b.mtime - a.mtime); // newest first

const cutoff  = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
let   deleted = 0;

files.forEach(file => {
  if (file.mtime < cutoff) {
    fs.unlinkSync(file.path);
    console.log(`  Deleted old backup: ${file.name}`);
    deleted++;
  }
});

if (deleted === 0) {
  console.log('  No old backups to clean up');
}

// ── Summary ───────────────────────────────────────────────────────
console.log('');
console.log('Backup summary:');
console.log(`  Latest: ${filename}`);
console.log(`  Total backups kept: ${files.length - deleted}`);
console.log(`  Deleted: ${deleted} old backup(s)`);
console.log('Done!');
