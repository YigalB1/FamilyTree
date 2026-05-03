import { getSession } from '../../lib/auth';
import pool           from '../../lib/db/client';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const result = await pool.query(`
      SELECT * FROM persons
      ORDER BY last_name_he NULLS LAST, first_name_he NULLS LAST
    `);

    return Response.json({ persons: result.rows });
  } catch (err) {
    console.error('GET persons error:', err);
    return Response.json({ error: 'Failed to fetch persons' }, { status: 500 });
  }
} // end of GET
