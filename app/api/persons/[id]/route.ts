import { getSession } from '../../../lib/auth';
import pool from '../../../lib/db/client';
import { logChange } from '../../../lib/db/changeLog';

// GET — fetch a single person by UUID or Geni ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { id } = await params;

    // Find person by UUID or Geni ID
    const personResult = await pool.query(
      'SELECT * FROM persons WHERE id::text = $1 OR geni_id = $1', [id]
    );
    if (!personResult.rows[0]) {
      return Response.json({ error: 'Person not found' }, { status: 404 });
    }
    const person = personResult.rows[0];

    // Use the actual database UUID for all subsequent queries
    const dbId = person.id;

    // Get families where this person is husband or wife
    const familiesResult = await pool.query(`
      SELECT f.*,
        hp.first_name_he as husb_first_he, hp.last_name_he as husb_last_he,
        hp.first_name_en as husb_first_en, hp.last_name_en as husb_last_en,
        wp.first_name_he as wife_first_he, wp.last_name_he as wife_last_he,
        wp.first_name_en as wife_first_en, wp.last_name_en as wife_last_en
      FROM families f
      LEFT JOIN persons hp ON f.husband_id = hp.id
      LEFT JOIN persons wp ON f.wife_id = wp.id
      WHERE f.husband_id = $1 OR f.wife_id = $1
    `, [dbId]);

    // Get parent family (where this person is a child)
    const parentFamilyResult = await pool.query(`
      SELECT f.*,
        hp.first_name_he as husb_first_he, hp.last_name_he as husb_last_he,
        hp.first_name_en as husb_first_en, hp.last_name_en as husb_last_en,
        wp.first_name_he as wife_first_he, wp.last_name_he as wife_last_he,
        wp.first_name_en as wife_first_en, wp.last_name_en as wife_last_en
      FROM families f
      LEFT JOIN persons hp ON f.husband_id = hp.id
      LEFT JOIN persons wp ON f.wife_id = wp.id
      JOIN family_children fc ON fc.family_id = f.id
      WHERE fc.child_id = $1
    `, [dbId]);

    // Get children
    const childrenResult = await pool.query(`
      SELECT p.id, p.first_name_he, p.last_name_he,
             p.first_name_en, p.last_name_en, p.birth_date, p.sex
      FROM persons p
      JOIN family_children fc ON fc.child_id = p.id
      JOIN families f ON fc.family_id = f.id
      WHERE f.husband_id = $1 OR f.wife_id = $1
      ORDER BY p.birth_date
    `, [dbId]);

    // Get change log
    const changeLogResult = await pool.query(`
      SELECT cl.*, u.name as changed_by_name
      FROM change_log cl
      LEFT JOIN users u ON cl.changed_by = u.id
      WHERE cl.record_id = $1
      ORDER BY cl.changed_at DESC
      LIMIT 50
    `, [dbId]);

    return Response.json({
      person,
      families:     familiesResult.rows,
      parentFamily: parentFamilyResult.rows[0] || null,
      children:     childrenResult.rows,
      changeLog:    changeLogResult.rows,
    });
  } catch (err) {
    console.error('GET person error:', err);
    return Response.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}

// PATCH — update a person
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const { id }  = await params;
    const updates = await request.json();

    // Find by UUID or Geni ID
    const current = await pool.query(
      'SELECT * FROM persons WHERE id::text = $1 OR geni_id = $1', [id]
    );
    if (!current.rows[0]) {
      return Response.json({ error: 'Person not found' }, { status: 404 });
    }
    const old  = current.rows[0];
    const dbId = old.id;

    // Fields that can be updated
    const allowedFields = [
      'first_name_he', 'last_name_he',
      'first_name_en', 'last_name_en',
      'sex', 'birth_date', 'birth_place',
      'death_date', 'death_place', 'notes',
    ];

    const setClauses: string[] = [];
    const values:     any[]    = [];
    let   paramIdx             = 1;

    for (const field of allowedFields) {
      if (field in updates) {
        setClauses.push(`${field} = $${paramIdx}`);
        values.push(updates[field]);
        paramIdx++;
      }
    }

    if (setClauses.length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(dbId);

    const result = await pool.query(
      `UPDATE persons SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    // Write change log for each changed field
    for (const field of allowedFields) {
      if (field in updates && updates[field] !== old[field]) {
        await logChange(
          'persons', dbId, field,
          old[field] || null,
          updates[field] || null,
          user.id, 'manual'
        );
      }
    }

    return Response.json({ person: result.rows[0] });
  } catch (err) {
    console.error('PATCH person error:', err);
    return Response.json({ error: 'Failed to update person' }, { status: 500 });
  }
}
