import pool from './client';

export interface DbPerson {
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
  created_at:    string;
  updated_at:    string;
}

export async function getAllPersons(): Promise<DbPerson[]> {
  const result = await pool.query(
    'SELECT * FROM persons ORDER BY last_name_he, first_name_he'
  );
  return result.rows;
}

export async function getPersonById(id: string): Promise<DbPerson | null> {
  const result = await pool.query('SELECT * FROM persons WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getPersonByGeniId(geniId: string): Promise<DbPerson | null> {
  const result = await pool.query('SELECT * FROM persons WHERE geni_id = $1', [geniId]);
  return result.rows[0] || null;
}

export async function upsertPerson(
  geniId:      string,
  firstNameHe: string,
  lastNameHe:  string,
  firstNameEn: string,
  lastNameEn:  string,
  sex:         string,
  birthDate:   string,
  birthPlace:  string,
  deathDate:   string,
  deathPlace:  string,
  sessionId:   string,
  userId:      string
): Promise<{ person: DbPerson; isNew: boolean }> {
  // Check if person already exists by geni_id
  const existing = await getPersonByGeniId(geniId);

  if (existing) {
    return { person: existing, isNew: false };
  }

  // Insert new person
  const result = await pool.query(
    `INSERT INTO persons (
      geni_id, first_name_he, last_name_he, first_name_en, last_name_en,
      sex, birth_date, birth_place, death_date, death_place,
      source_id, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *`,
    [
      geniId, firstNameHe, lastNameHe, firstNameEn, lastNameEn,
      sex, birthDate, birthPlace, deathDate, deathPlace,
      sessionId, userId
    ]
  );
  return { person: result.rows[0], isNew: true };
}

export async function countPersons(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) FROM persons');
  return parseInt(result.rows[0].count);
}
