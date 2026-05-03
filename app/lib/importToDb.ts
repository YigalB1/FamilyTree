import { GedcomData } from './parseGedcom';
import pool           from './db/client';
import { logNewRecord } from './db/changeLog';
import { createImportSession, updateImportSession } from './db/importSessions';

export interface ImportResult {
  sessionId:       string;
  personsAdded:    number;
  personsSkipped:  number;
  familiesAdded:   number;
  familiesSkipped: number;
} // end of ImportResult interface

export async function importGedcomToDb(
  data:       GedcomData,
  filename:   string,
  sourceName: string,
  userId:     string
): Promise<ImportResult> {

  // Create import session
  const session   = await createImportSession(filename, sourceName, userId);
  const sessionId = session.id;

  let personsAdded    = 0;
  let personsSkipped  = 0;
  let familiesAdded   = 0;
  let familiesSkipped = 0;

  // Map GEDCOM IDs to database UUIDs
  const personIdMap: Record<string, string> = {};

  // ── Import persons ────────────────────────────────────────────
  for (const person of data.persons) {

    // Check if already exists by geni_id
    const existing = await pool.query(
      'SELECT id FROM persons WHERE geni_id = $1', [person.id]
    );

    if (existing.rows[0]) {
      personIdMap[person.id] = existing.rows[0].id;

      // Update photo_url if Geni has one and DB doesn't
      if (person.photoUrl) {
        await pool.query(
          `UPDATE persons SET photo_url = $1
           WHERE geni_id = $2 AND (photo_url IS NULL OR photo_url = '')`,
          [person.photoUrl, person.id]
        );
      } // end if photoUrl

      personsSkipped++;
      continue;
    } // end if existing

    // Insert new person
    const result = await pool.query(
      `INSERT INTO persons (
        geni_id, first_name_he, last_name_he, first_name_en, last_name_en,
        sex, birth_date, birth_place, death_date, death_place, photo_url,
        source_id, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        person.id,
        person.firstNameHe  || null,
        person.lastNameHe   || null,
        person.firstNameEn  || null,
        person.lastNameEn   || null,
        person.sex          || null,
        person.birthDate    || null,
        person.birthPlace   || null,
        person.deathDate    || null,
        person.deathPlace   || null,
        person.photoUrl     || null,
        sessionId,
        userId,
      ]
    );

    personIdMap[person.id] = result.rows[0].id;
    personsAdded++;

    // Log all fields
    await logNewRecord('persons', result.rows[0].id, {
      geni_id:       person.id,
      first_name_he: person.firstNameHe || '',
      last_name_he:  person.lastNameHe  || '',
      first_name_en: person.firstNameEn || '',
      last_name_en:  person.lastNameEn  || '',
      sex:           person.sex         || '',
      birth_date:    person.birthDate   || '',
      birth_place:   person.birthPlace  || '',
      death_date:    person.deathDate   || '',
      death_place:   person.deathPlace  || '',
      photo_url:     person.photoUrl    || '',
    }, userId, sessionId);
  } // end for persons

  // ── Import families ───────────────────────────────────────────
  for (const family of data.families) {
    const existingFam = await pool.query(
      'SELECT id FROM families WHERE geni_id = $1', [family.id]
    );

    if (existingFam.rows[0]) {
      familiesSkipped++;
      continue;
    } // end if existing family

    const husbandDbId = family.husbandId ? personIdMap[family.husbandId] : null;
    const wifeDbId    = family.wifeId    ? personIdMap[family.wifeId]    : null;

    const famResult = await pool.query(
      `INSERT INTO families (
        geni_id, husband_id, wife_id,
        marriage_date, marriage_place, divorced, source_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *`,
      [
        family.id,
        husbandDbId    || null,
        wifeDbId       || null,
        family.marriageDate  || null,
        family.marriagePlace || null,
        family.divorced      || false,
        sessionId,
      ]
    );

    familiesAdded++;

    // Add children
    for (const childGeniId of family.childrenIds) {
      const childDbId = personIdMap[childGeniId];
      if (childDbId) {
        await pool.query(
          `INSERT INTO family_children (family_id, child_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [famResult.rows[0].id, childDbId]
        );
      } // end if childDbId
    } // end for children
  } // end for families

  // Update session
  await updateImportSession(
    sessionId, personsAdded, 0, personsSkipped, 0, 'completed'
  );

  return { sessionId, personsAdded, personsSkipped, familiesAdded, familiesSkipped };
} // end of importGedcomToDb
