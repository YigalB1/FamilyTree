import { GedcomData, Person } from './parseGedcom';
import pool from './db/client';

export interface PersonComparison {
  geniId:      string;
  status:      'new' | 'identical' | 'changed';
  gedcomPerson: Person;
  dbPerson:    DbPersonRow | null;
  changes:     FieldChange[];
} // end of PersonComparison interface

export interface FieldChange {
  field:         string;
  label:         string;
  existingValue: string;
  newValue:      string;
  manuallyEdited: boolean;
} // end of FieldChange interface

export interface CompareResult {
  newPersons:      PersonComparison[];
  changedPersons:  PersonComparison[];
  identicalCount:  number;
  totalInGedcom:   number;
  totalInDb:       number;
} // end of CompareResult interface

interface DbPersonRow {
  id:            string;
  geni_id:       string;
  first_name_he: string;
  last_name_he:  string;
  first_name_en: string;
  last_name_en:  string;
  sex:           string;
  birth_date:    string;
  birth_place:   string;
  death_date:    string;
  death_place:   string;
  notes:         string;
} // end of DbPersonRow interface

// Map GEDCOM Person fields to DB column names
const FIELD_MAP: { gedcom: keyof Person; db: keyof DbPersonRow; label: string }[] = [
  { gedcom: 'firstNameHe', db: 'first_name_he', label: 'First name (Hebrew)'  },
  { gedcom: 'lastNameHe',  db: 'last_name_he',  label: 'Last name (Hebrew)'   },
  { gedcom: 'firstNameEn', db: 'first_name_en', label: 'First name (English)' },
  { gedcom: 'lastNameEn',  db: 'last_name_en',  label: 'Last name (English)'  },
  { gedcom: 'sex',         db: 'sex',           label: 'Sex'                  },
  { gedcom: 'birthDate',   db: 'birth_date',    label: 'Birth date'           },
  { gedcom: 'birthPlace',  db: 'birth_place',   label: 'Birth place'          },
  { gedcom: 'deathDate',   db: 'death_date',    label: 'Death date'           },
  { gedcom: 'deathPlace',  db: 'death_place',   label: 'Death place'          },
]; // end of FIELD_MAP

export async function compareGedcomWithDb(data: GedcomData): Promise<CompareResult> {
  // Load all persons from DB into a map by geni_id for fast lookup
  const dbResult = await pool.query('SELECT * FROM persons');
  const dbByGeniId: Record<string, DbPersonRow> = {};
  for (const row of dbResult.rows) {
    if (row.geni_id) dbByGeniId[row.geni_id] = row;
  } // end for

  // Load manually edited fields from change_log
  const editedResult = await pool.query(`
    SELECT DISTINCT record_id, field
    FROM change_log
    WHERE source = 'manual'
  `);
  const manualEdits = new Set<string>();
  for (const row of editedResult.rows) {
    manualEdits.add(`${row.record_id}:${row.field}`);
  } // end for

  const newPersons:     PersonComparison[] = [];
  const changedPersons: PersonComparison[] = [];
  let   identicalCount                     = 0;

  for (const gedcomPerson of data.persons) {
    const dbPerson = dbByGeniId[gedcomPerson.id] || null;

    if (!dbPerson) {
      // Person not in DB — new
      newPersons.push({
        geniId:       gedcomPerson.id,
        status:       'new',
        gedcomPerson,
        dbPerson:     null,
        changes:      [],
      });
      continue;
    } // end if new

    // Compare fields
    const changes: FieldChange[] = [];
    for (const { gedcom, db, label } of FIELD_MAP) {
      const gedcomVal = (gedcomPerson[gedcom] as string) || '';
      const dbVal     = (dbPerson[db]         as string) || '';
      if (gedcomVal !== dbVal) {
        const manuallyEdited = manualEdits.has(`${dbPerson.id}:${db}`);
        changes.push({
          field:          db,
          label,
          existingValue:  dbVal,
          newValue:       gedcomVal,
          manuallyEdited,
        });
      } // end if different
    } // end for fields

    if (changes.length === 0) {
      identicalCount++;
    } else {
      changedPersons.push({
        geniId:       gedcomPerson.id,
        status:       'changed',
        gedcomPerson,
        dbPerson,
        changes,
      });
    } // end if changes
  } // end for persons

  return {
    newPersons,
    changedPersons,
    identicalCount,
    totalInGedcom: data.persons.length,
    totalInDb:     dbResult.rows.length,
  };
} // end of compareGedcomWithDb
