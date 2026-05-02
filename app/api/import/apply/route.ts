import { getSession }           from '../../../lib/auth';
import pool                     from '../../../lib/db/client';
import { logChange }            from '../../../lib/db/changeLog';
import { createImportSession, updateImportSession } from '../../../lib/db/importSessions';
import { upsertPerson }         from '../../../lib/db/persons';
import { upsertFamily, addChildToFamily } from '../../../lib/db/families';
import { parseGedcom }          from '../../../lib/parseGedcom';

interface Resolution {
  geniId:    string;
  action:    'add' | 'update' | 'skip';
  fields?:   Record<string, 'keep' | 'update'>; // per-field resolution for changed persons
} // end of Resolution interface

export async function POST(request: Request) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const formData    = await request.formData();
    const file        = formData.get('file')        as File;
    const resolutionsJson = formData.get('resolutions') as string;
    const sourceName  = formData.get('source')      as string || 'Geni';

    if (!file)        return Response.json({ error: 'No file provided' },      { status: 400 });
    if (!resolutionsJson) return Response.json({ error: 'No resolutions provided' }, { status: 400 });

    const resolutions: Resolution[] = JSON.parse(resolutionsJson);
    const resolutionMap: Record<string, Resolution> = {};
    for (const r of resolutions) resolutionMap[r.geniId] = r;

    // Parse GEDCOM
    const text   = await file.text();
    const parsed = parseGedcom(text);

    // Create import session
    const session   = await createImportSession(file.name, sourceName, user.id);
    const sessionId = session.id;

    let personsAdded   = 0;
    let personsUpdated = 0;
    let personsSkipped = 0;

    // Map GEDCOM IDs to DB UUIDs
    const personIdMap: Record<string, string> = {};

    // Load existing persons into map
    const existing = await pool.query('SELECT id, geni_id FROM persons WHERE geni_id IS NOT NULL');
    for (const row of existing.rows) {
      personIdMap[row.geni_id] = row.id;
    } // end for existing

    // Process each person
    for (const person of parsed.persons) {
      const resolution = resolutionMap[person.id];
      const action     = resolution?.action || 'skip';

      if (action === 'skip') {
        personsSkipped++;
        // Still map existing ID
        if (personIdMap[person.id]) continue;
        continue;
      } // end if skip

      if (action === 'add') {
        // New person — insert
        const { person: dbPerson } = await upsertPerson(
          person.id,
          person.firstNameHe || '', person.lastNameHe  || '',
          person.firstNameEn || '', person.lastNameEn  || '',
          person.sex         || '',
          person.birthDate   || '', person.birthPlace  || '',
          person.deathDate   || '', person.deathPlace  || '',
          sessionId, user.id
        );
        personIdMap[person.id] = dbPerson.id;
        personsAdded++;
      } else if (action === 'update') {
        // Existing person — update selected fields
        const dbId  = personIdMap[person.id];
        if (!dbId) continue;

        const fields = resolution.fields || {};
        const updates: Record<string, string> = {};

        const fieldMap: Record<string, string> = {
          first_name_he: person.firstNameHe || '',
          last_name_he:  person.lastNameHe  || '',
          first_name_en: person.firstNameEn || '',
          last_name_en:  person.lastNameEn  || '',
          sex:           person.sex         || '',
          birth_date:    person.birthDate   || '',
          birth_place:   person.birthPlace  || '',
          death_date:    person.deathDate   || '',
          death_place:   person.deathPlace  || '',
        };

        for (const [field, value] of Object.entries(fieldMap)) {
          if (fields[field] === 'update') updates[field] = value;
        } // end for fields

        if (Object.keys(updates).length > 0) {
          // Get old values for change log
          const oldResult = await pool.query('SELECT * FROM persons WHERE id = $1', [dbId]);
          const old       = oldResult.rows[0];

          // Build update query
          const setClauses = Object.keys(updates).map((f, i) => `${f} = $${i + 1}`);
          const values     = [...Object.values(updates), dbId];
          await pool.query(
            `UPDATE persons SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length}`,
            values
          );

          // Log each change
          for (const [field, newVal] of Object.entries(updates)) {
            await logChange('persons', dbId, field, old[field] || null, newVal, user.id, 'import', sessionId);
          } // end for changes

          personsUpdated++;
        } // end if updates
      } // end if action
    } // end for persons

    // Re-import families (always refresh relationships)
    let familiesAdded = 0;
    for (const family of parsed.families) {
      const husbandDbId = family.husbandId ? personIdMap[family.husbandId] : null;
      const wifeDbId    = family.wifeId    ? personIdMap[family.wifeId]    : null;
      const { isNew }   = await upsertFamily(
        family.id,
        husbandDbId || null,
        wifeDbId    || null,
        family.marriageDate  || '',
        family.marriagePlace || '',
        family.divorced      || false,
        sessionId
      );
      if (isNew) {
        familiesAdded++;
        for (const childGeniId of family.childrenIds) {
          const childDbId = personIdMap[childGeniId];
          if (childDbId) {
            const famResult = await pool.query('SELECT id FROM families WHERE geni_id = $1', [family.id]);
            if (famResult.rows[0]) await addChildToFamily(famResult.rows[0].id, childDbId);
          } // end if childDbId
        } // end for children
      } // end if isNew
    } // end for families

    await updateImportSession(sessionId, personsAdded, personsUpdated, personsSkipped, 0, 'completed');

    return Response.json({
      success: true,
      personsAdded,
      personsUpdated,
      personsSkipped,
      familiesAdded,
    });
  } catch (err) {
    console.error('Apply error:', err);
    return Response.json({ error: 'Apply failed' }, { status: 500 });
  }
} // end of POST
