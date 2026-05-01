import pool from './client';

export interface ImportSession {
  id:               string;
  filename:         string;
  source_name:      string;
  imported_at:      string;
  imported_by:      string;
  persons_added:    number;
  persons_updated:  number;
  persons_skipped:  number;
  conflicts_found:  number;
  status:           string;
}

export async function createImportSession(
  filename:   string,
  sourceName: string,
  userId:     string
): Promise<ImportSession> {
  const result = await pool.query(
    `INSERT INTO import_sessions (filename, source_name, imported_by, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [filename, sourceName, userId]
  );
  return result.rows[0];
}

export async function updateImportSession(
  id:              string,
  personsAdded:    number,
  personsUpdated:  number,
  personsSkipped:  number,
  conflictsFound:  number,
  status:          string
): Promise<void> {
  await pool.query(
    `UPDATE import_sessions
     SET persons_added=$1, persons_updated=$2, persons_skipped=$3,
         conflicts_found=$4, status=$5
     WHERE id=$6`,
    [personsAdded, personsUpdated, personsSkipped, conflictsFound, status, id]
  );
}

export async function getAllImportSessions(): Promise<ImportSession[]> {
  const result = await pool.query(
    `SELECT s.*, u.name as imported_by_name
     FROM import_sessions s
     LEFT JOIN users u ON s.imported_by = u.id
     ORDER BY s.imported_at DESC`
  );
  return result.rows;
}
