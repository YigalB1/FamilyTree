import { getSession } from '../../../lib/auth';
import pool           from '../../../lib/db/client';
import { logChange }  from '../../../lib/db/changeLog';

interface NewPersonData {
  // Basic fields
  first_name_he:  string;
  last_name_he:   string;
  first_name_en:  string;
  last_name_en:   string;
  sex:            string;
  birth_date:     string;
  birth_place:    string;
  death_date:     string;
  death_place:    string;
  notes:          string;
  // Relationship
  relationship:   'child' | 'spouse' | 'parent' | 'sibling';
  relatedPersonId: string; // DB UUID of existing person
  // Spouse-specific
  marriage_date:  string;
  marriage_place: string;
  divorced:       boolean;
  // Child-specific (which family to add child to)
  familyId?:      string;
} // end of NewPersonData interface

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const body: NewPersonData = await request.json();
    const { relationship, relatedPersonId } = body;

    // ── Validate ───────────────────────────────────────────────
    if (!relationship || !relatedPersonId) {
      return Response.json({ error: 'Relationship and related person are required' }, { status: 400 });
    } // end if missing

    const hasName = body.first_name_he || body.last_name_he ||
                    body.first_name_en || body.last_name_en;
    if (!hasName) {
      return Response.json({ error: 'At least one name field is required' }, { status: 400 });
    } // end if no name

    // ── Get related person ─────────────────────────────────────
    const relatedResult = await pool.query(
      'SELECT * FROM persons WHERE id = $1', [relatedPersonId]
    );
    if (!relatedResult.rows[0]) {
      return Response.json({ error: 'Related person not found' }, { status: 404 });
    } // end if not found
    const relatedPerson = relatedResult.rows[0];

    // ── Create new person ──────────────────────────────────────
    const personResult = await pool.query(
      `INSERT INTO persons (
        first_name_he, last_name_he, first_name_en, last_name_en,
        sex, birth_date, birth_place, death_date, death_place, notes,
        created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        body.first_name_he  || null,
        body.last_name_he   || null,
        body.first_name_en  || null,
        body.last_name_en   || null,
        body.sex            || null,
        body.birth_date     || null,
        body.birth_place    || null,
        body.death_date     || null,
        body.death_place    || null,
        body.notes          || null,
        user.id,
      ]
    );
    const newPerson = personResult.rows[0];
    const newId     = newPerson.id;

    // Log new person creation
    const fields: Record<string, string> = {
      first_name_he: body.first_name_he,
      last_name_he:  body.last_name_he,
      first_name_en: body.first_name_en,
      last_name_en:  body.last_name_en,
      sex:           body.sex,
      birth_date:    body.birth_date,
      birth_place:   body.birth_place,
    };
    for (const [field, value] of Object.entries(fields)) {
      if (value) {
        await logChange('persons', newId, field, null, value, user.id, 'manual');
      } // end if value
    } // end for fields

    // ── Create family link based on relationship ───────────────

    if (relationship === 'spouse') {
      // Create new family record linking existing person + new person
      const husbandId = relatedPerson.sex === 'M' ? relatedPersonId : newId;
      const wifeId    = relatedPerson.sex === 'M' ? newId : relatedPersonId;

      const famResult = await pool.query(
        `INSERT INTO families (husband_id, wife_id, marriage_date, marriage_place, divorced, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          husbandId,
          wifeId,
          body.marriage_date  || null,
          body.marriage_place || null,
          body.divorced       || false,
          user.id,
        ]
      );
      await logChange('families', famResult.rows[0].id, 'created', null,
        `Family: ${relatedPersonId} + ${newId}`, user.id, 'manual');
    } // end if spouse

    else if (relationship === 'child') {
      // Find or create family where related person is a parent
      let familyId = body.familyId || null;

      if (!familyId) {
        // Find existing family where related person is husband or wife
        const famResult = await pool.query(
          `SELECT id FROM families
           WHERE husband_id = $1 OR wife_id = $1
           ORDER BY created_at ASC LIMIT 1`,
          [relatedPersonId]
        );
        if (famResult.rows[0]) {
          familyId = famResult.rows[0].id;
        } else {
          // Create new single-parent family
          const husbandId = relatedPerson.sex === 'M' ? relatedPersonId : null;
          const wifeId    = relatedPerson.sex === 'F' ? relatedPersonId : null;
          const newFam    = await pool.query(
            `INSERT INTO families (husband_id, wife_id, created_by)
             VALUES ($1, $2, $3) RETURNING *`,
            [husbandId, wifeId, user.id]
          );
          familyId = newFam.rows[0].id;
        } // end if no existing family
      } // end if no familyId

      // Add new person as child
      await pool.query(
        'INSERT INTO family_children (family_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [familyId, newId]
      );
      await logChange('family_children', familyId, 'child_added', null, newId, user.id, 'manual');
    } // end if child

    else if (relationship === 'parent') {
      // Find existing parent family for related person
      const existingFamResult = await pool.query(
        `SELECT f.* FROM families f
         JOIN family_children fc ON fc.family_id = f.id
         WHERE fc.child_id = $1 LIMIT 1`,
        [relatedPersonId]
      );

      if (existingFamResult.rows[0]) {
        // Add new person to existing family as husband or wife
        const fam        = existingFamResult.rows[0];
        const isHusband  = body.sex === 'M';
        const updateCol  = isHusband ? 'husband_id' : 'wife_id';
        const currentVal = isHusband ? fam.husband_id : fam.wife_id;

        if (!currentVal) {
          await pool.query(
            `UPDATE families SET ${updateCol} = $1 WHERE id = $2`,
            [newId, fam.id]
          );
          await logChange('families', fam.id, updateCol, null, newId, user.id, 'manual');
        } // end if slot available
      } else {
        // Create new family with new person as parent, related person as child
        const husbandId = body.sex === 'M' ? newId : null;
        const wifeId    = body.sex === 'F' ? newId : null;
        const newFam    = await pool.query(
          `INSERT INTO families (husband_id, wife_id, created_by)
           VALUES ($1, $2, $3) RETURNING *`,
          [husbandId, wifeId, user.id]
        );
        await pool.query(
          'INSERT INTO family_children (family_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newFam.rows[0].id, relatedPersonId]
        );
        await logChange('families', newFam.rows[0].id, 'created', null,
          `Parent family for ${relatedPersonId}`, user.id, 'manual');
      } // end if existing family
    } // end if parent

    else if (relationship === 'sibling') {
      // Find parent family of related person
      const parentFamResult = await pool.query(
        `SELECT f.* FROM families f
         JOIN family_children fc ON fc.family_id = f.id
         WHERE fc.child_id = $1 LIMIT 1`,
        [relatedPersonId]
      );

      if (parentFamResult.rows[0]) {
        // Add new person to same parent family
        const famId = parentFamResult.rows[0].id;
        await pool.query(
          'INSERT INTO family_children (family_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [famId, newId]
        );
        await logChange('family_children', famId, 'child_added', null, newId, user.id, 'manual');
      } else {
        // Related person has no parents — create a shared parent family
        const newFam = await pool.query(
          `INSERT INTO families (created_by) VALUES ($1) RETURNING *`,
          [user.id]
        );
        await pool.query(
          'INSERT INTO family_children (family_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newFam.rows[0].id, relatedPersonId]
        );
        await pool.query(
          'INSERT INTO family_children (family_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [newFam.rows[0].id, newId]
        );
        await logChange('families', newFam.rows[0].id, 'created', null,
          `Sibling family for ${relatedPersonId} + ${newId}`, user.id, 'manual');
      } // end if no parent family
    } // end if sibling

    return Response.json({ success: true, person: newPerson });
  } catch (err) {
    console.error('Add person error:', err);
    return Response.json({ error: 'Failed to add person' }, { status: 500 });
  }
} // end of POST
