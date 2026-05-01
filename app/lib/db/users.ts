import pool from './client';
import bcrypt from 'bcryptjs';

export interface User {
  id:         string;
  email:      string;
  name:       string;
  role:       'admin' | 'editor' | 'viewer';
  created_at: string;
  last_login: string;
}

// Count total users in the database
export async function countUsers(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) FROM users');
  return parseInt(result.rows[0].count);
}

// Create a new user
export async function createUser(
  email: string,
  name: string,
  password: string,
  role: 'admin' | 'editor' | 'viewer' = 'viewer'
): Promise<User> {
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    `INSERT INTO users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at, last_login`,
    [email, name, hash, role]
  );
  return result.rows[0];
}

// Find user by email
export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const result = await pool.query(
    'SELECT id, email, name, role, password_hash, created_at, last_login FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

// Find user by ID
export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Update last login timestamp
export async function updateLastLogin(id: string): Promise<void> {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [id]);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Get all users (admin only)
export async function getAllUsers(): Promise<User[]> {
  const result = await pool.query(
    'SELECT id, email, name, role, created_at, last_login FROM users ORDER BY created_at ASC'
  );
  return result.rows;
}

// Update user role
export async function updateUserRole(id: string, role: 'admin' | 'editor' | 'viewer'): Promise<void> {
  await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
}
