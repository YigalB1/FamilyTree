import pool from './client';

export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connected at:', result.rows[0].now);
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  }
}