import pool from './client';

export async function logChange(
  tableName:  string,
  recordId:   string,
  field:      string,
  oldValue:   string | null,
  newValue:   string | null,
  changedBy:  string,
  source:     string = 'manual',
  sessionId:  string | null = null
): Promise<void> {
  await pool.query(
    `INSERT INTO change_log
      (table_name, record_id, field, old_value, new_value, changed_by, source, session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [tableName, recordId, field, oldValue, newValue, changedBy, source, sessionId]
  );
}

export async function logNewRecord(
  tableName:  string,
  recordId:   string,
  data:       Record<string, string>,
  changedBy:  string,
  sessionId:  string | null = null
): Promise<void> {
  for (const [field, value] of Object.entries(data)) {
    if (value) {
      await logChange(tableName, recordId, field, null, value, changedBy, 'import', sessionId);
    }
  }
}

export async function getChangeLog(
  recordId?: string,
  limit:     number = 100
): Promise<any[]> {
  if (recordId) {
    const result = await pool.query(
      `SELECT cl.*, u.name as changed_by_name
       FROM change_log cl
       LEFT JOIN users u ON cl.changed_by = u.id
       WHERE cl.record_id = $1
       ORDER BY cl.changed_at DESC
       LIMIT $2`,
      [recordId, limit]
    );
    return result.rows;
  }
  const result = await pool.query(
    `SELECT cl.*, u.name as changed_by_name
     FROM change_log cl
     LEFT JOIN users u ON cl.changed_by = u.id
     ORDER BY cl.changed_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
