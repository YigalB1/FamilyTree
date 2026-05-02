import { getSession } from '../../../lib/auth';
import pool           from '../../../lib/db/client';

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user)                return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' },       { status: 403 });

    const { confirm } = await request.json();

    // Require explicit confirmation string
    if (confirm !== 'DELETE ALL DATA') {
      return Response.json({ error: 'Invalid confirmation' }, { status: 400 });
    } // end if confirm

    // Delete in correct order to respect foreign key constraints
    await pool.query('DELETE FROM change_log');
    await pool.query('DELETE FROM import_conflicts');
    await pool.query('DELETE FROM family_children');
    await pool.query('DELETE FROM families');
    await pool.query('DELETE FROM persons');
    await pool.query('DELETE FROM import_sessions');

    // Get counts to confirm
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM persons)         as persons,
        (SELECT COUNT(*) FROM families)        as families,
        (SELECT COUNT(*) FROM change_log)      as change_log,
        (SELECT COUNT(*) FROM import_sessions) as import_sessions
    `);

    return Response.json({
      success: true,
      message: 'All genealogy data deleted successfully. User accounts preserved.',
      counts:  counts.rows[0],
    });
  } catch (err) {
    console.error('Delete data error:', err);
    return Response.json({ error: 'Failed to delete data' }, { status: 500 });
  }
} // end of POST
