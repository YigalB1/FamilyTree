import { getSession } from '../../lib/auth';
import pool           from '../../lib/db/client';

export async function GET() {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    // Get all families
    const familiesResult = await pool.query('SELECT * FROM families');

    // Get all children
    const childrenResult = await pool.query(
      'SELECT family_id, child_id FROM family_children'
    );

    // Build children map
    const childrenMap: Record<string, string[]> = {};
    for (const row of childrenResult.rows) {
      if (!childrenMap[row.family_id]) childrenMap[row.family_id] = [];
      childrenMap[row.family_id].push(row.child_id);
    } // end for children

    // Attach children to families
    const families = familiesResult.rows.map(f => ({
      ...f,
      children_ids: childrenMap[f.id] || [],
    }));

    return Response.json({ families });
  } catch (err) {
    console.error('GET families error:', err);
    return Response.json({ error: 'Failed to fetch families' }, { status: 500 });
  }
} // end of GET
