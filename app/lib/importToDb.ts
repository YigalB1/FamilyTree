import { GedcomData } from './parseGedcom';
import { upsertPerson } from './db/persons';
import { upsertFamily, addChildToFamily } from './db/families';
import { createImportSession, updateImportSession } from './db/importSessions';
import { logNewRecord } from './db/changeLog';

export interface ImportResult {
  sessionId:      string;
  personsAdded:   number;
  personsSkipped: number;
  familiesAdded:  number;
  familiesSkipped: number;
}

export async function importGedcomToDb(
  data:       GedcomData,
  filename:   string,
  sourceName: string,
  userId:     string
): Promise<ImportResult> {

  // Create import session
  const session = await createImportSession(filename, sourceName, userId);
  const sessionId = session.id;

  let personsAdded   = 0;
  let personsSkipped = 0;
  let familiesAdded  = 0;
  let familiesSkipped = 0;

  // Map GEDCOM IDs to database UUIDs
  const personIdMap: Record<string, string> = {};

  // ── Import persons ───────────────────────────────────────────
  for (const person of data.persons) {
    const { person: dbPerson, isNew } = await upsertPerson(
      person.id,
      person.firstNameHe || '',
      person.lastNameHe  || '',
      person.firstNameEn || '',
      person.lastNameEn  || '',
      person.sex         || '',
      person.birthDate   || '',
      person.birthPlace  || '',
      person.deathDate   || '',
      person.deathPlace  || '',
      sessionId,
      userId
    );

    personIdMap[person.id] = dbPerson.id;

    if (isNew) {
      personsAdded++;
      // Log all fields for new person
      await logNewRecord('persons', dbPerson.id, {
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
      }, userId, sessionId);
    } else {
      personsSkipped++;
    }
  }

  // ── Import families ──────────────────────────────────────────
  for (const family of data.families) {
    const husbandDbId = family.husbandId ? personIdMap[family.husbandId] : null;
    const wifeDbId    = family.wifeId    ? personIdMap[family.wifeId]    : null;

    const { family: dbFamily, isNew } = await upsertFamily(
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
      // Add children
      for (const childGeniId of family.childrenIds) {
        const childDbId = personIdMap[childGeniId];
        if (childDbId) {
          await addChildToFamily(dbFamily.id, childDbId);
        }
      }
    } else {
      familiesSkipped++;
    }
  }

  // Update session with results
  await updateImportSession(
    sessionId,
    personsAdded,
    0,
    personsSkipped,
    0,
    'completed'
  );

  return { sessionId, personsAdded, personsSkipped, familiesAdded, familiesSkipped };
}
