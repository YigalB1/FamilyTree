import pool from './client';

export interface DbFamily {
  id:             string;
  geni_id:        string;
  husband_id:     string;
  wife_id:        string;
  marriage_date:  string;
  marriage_place: string;
  divorced:       boolean;
}

export async function getAllFamilies(): Promise<DbFamily[]> {
  const result = await pool.query('SELECT * FROM families');
  return result.rows;
}

export async function getFamilyByGeniId(geniId: string): Promise<DbFamily | null> {
  const result = await pool.query('SELECT * FROM families WHERE geni_id = $1', [geniId]);
  return result.rows[0] || null;
}

export async function upsertFamily(
  geniId:        string,
  husbandId:     string | null,
  wifeId:        string | null,
  marriageDate:  string,
  marriagePlace: string,
  divorced:      boolean,
  sessionId:     string
): Promise<{ family: DbFamily; isNew: boolean }> {
  const existing = await getFamilyByGeniId(geniId);
  if (existing) return { family: existing, isNew: false };

  const result = await pool.query(
    `INSERT INTO families (
      geni_id, husband_id, wife_id, marriage_date, marriage_place, divorced, source_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *`,
    [geniId, husbandId || null, wifeId || null, marriageDate, marriagePlace, divorced, sessionId]
  );
  return { family: result.rows[0], isNew: true };
}

export async function addChildToFamily(familyId: string, childId: string): Promise<void> {
  await pool.query(
    `INSERT INTO family_children (family_id, child_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [familyId, childId]
  );
}

export async function getFamilyChildren(familyId: string): Promise<string[]> {
  const result = await pool.query(
    'SELECT child_id FROM family_children WHERE family_id = $1',
    [familyId]
  );
  return result.rows.map((r: { child_id: string }) => r.child_id);
}

export async function countFamilies(): Promise<number> {
  const result = await pool.query('SELECT COUNT(*) FROM families');
  return parseInt(result.rows[0].count);
}
