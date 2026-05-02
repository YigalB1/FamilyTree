import { getSession } from '../../lib/auth';
import pool           from '../../lib/db/client';

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search    = searchParams.get('search')    || '';
    const field     = searchParams.get('field')     || '';
    const source    = searchParams.get('source')    || '';
    const dateFrom  = searchParams.get('dateFrom')  || '';
    const dateTo    = searchParams.get('dateTo')    || '';
    const page      = parseInt(searchParams.get('page') || '1');
    const pageSize  = 50;
    const offset    = (page - 1) * pageSize;

    // Build WHERE clauses
    const conditions: string[] = [];
    const values:     any[]    = [];
    let   idx                  = 1;

    if (field) {
      conditions.push(`cl.field = $${idx++}`);
      values.push(field);
    } // end if field

    if (source) {
      conditions.push(`cl.source = $${idx++}`);
      values.push(source);
    } // end if source

    if (dateFrom) {
      conditions.push(`cl.changed_at >= $${idx++}`);
      values.push(dateFrom);
    } // end if dateFrom

    if (dateTo) {
      conditions.push(`cl.changed_at <= $${idx++}::date + interval '1 day'`);
      values.push(dateTo);
    } // end if dateTo

    if (search) {
      conditions.push(`(
        p.first_name_he ILIKE $${idx} OR p.last_name_he  ILIKE $${idx} OR
        p.first_name_en ILIKE $${idx} OR p.last_name_en  ILIKE $${idx} OR
        cl.old_value    ILIKE $${idx} OR cl.new_value     ILIKE $${idx}
      )`);
      values.push(`%${search}%`);
      idx++;
    } // end if search

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countResult = await pool.query(`
      SELECT COUNT(*) FROM change_log cl
      LEFT JOIN persons p ON cl.record_id = p.id
      LEFT JOIN users   u ON cl.changed_by = u.id
      ${whereClause}
    `, values);
    const total = parseInt(countResult.rows[0].count);

    // Fetch page
    const result = await pool.query(`
      SELECT
        cl.id,
        cl.table_name,
        cl.record_id,
        cl.field,
        cl.old_value,
        cl.new_value,
        cl.changed_at,
        cl.source,
        u.name  as changed_by_name,
        p.first_name_he, p.last_name_he,
        p.first_name_en, p.last_name_en,
        p.geni_id
      FROM change_log cl
      LEFT JOIN persons p ON cl.record_id = p.id
      LEFT JOIN users   u ON cl.changed_by = u.id
      ${whereClause}
      ORDER BY cl.changed_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `, values);

    // Get distinct fields for filter dropdown
    const fieldsResult = await pool.query(
      'SELECT DISTINCT field FROM change_log ORDER BY field'
    );

    return Response.json({
      entries:    result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      fields:     fieldsResult.rows.map((r: any) => r.field),
    });
  } catch (err) {
    console.error('Change log error:', err);
    return Response.json({ error: 'Failed to fetch change log' }, { status: 500 });
  }
} // end of GET
