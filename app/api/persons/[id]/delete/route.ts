// app/api/persons/[id]/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSession }                from '@/app/lib/auth';
import pool                          from '@/app/lib/db/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user)                return NextResponse.json({ error: 'Not authenticated' },  { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Admins only' },        { status: 403 });

    const { id } = await params;

    // ── Check for children ────────────────────────────────────
    // Person must not be a parent of any children
    const childCheck = await pool.query(`
      SELECT COUNT(*) AS cnt
      FROM family_children fc
      JOIN families f ON f.id = fc.family_id
      WHERE f.husband_id = $1 OR f.wife_id = $1
    `, [id]);

    if (parseInt(childCheck.rows[0].cnt) > 0) {
      return NextResponse.json({
        error: 'Cannot delete: this person has children. Delete the children first.',
      }, { status: 400 });
    } // end if children

    // ── Delete in correct order ───────────────────────────────

    // 1. Remove from family_children (as a child themselves)
    await pool.query(`
      DELETE FROM family_children fc
      USING families f
      WHERE fc.family_id = f.id
        AND fc.child_id = $1
    `, [id]);

    // 2. Remove families where this person is husband or wife
    //    First get those family IDs
    const famResult = await pool.query(`
      SELECT id FROM families
      WHERE husband_id = $1 OR wife_id = $1
    `, [id]);

    for (const fam of famResult.rows) {
      // Remove all children links from these families
      await pool.query('DELETE FROM family_children WHERE family_id = $1', [fam.id]);
      // Delete the family record
      await pool.query('DELETE FROM families WHERE id = $1', [fam.id]);
    } // end for families

    // 3. Delete change log entries for this person
    await pool.query('DELETE FROM change_log WHERE record_id = $1', [id]);

    // 4. Delete local photo if exists
    const { existsSync, unlinkSync } = await import('fs');
    const path = await import('path');
    const photoPath = path.join(process.cwd(), 'public', 'photos', `${id}.jpg`);
    if (existsSync(photoPath)) {
      unlinkSync(photoPath);
    } // end if photo exists

    // 5. Delete the person
    await pool.query('DELETE FROM persons WHERE id = $1', [id]);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('Delete person error:', err);
    return NextResponse.json({ error: 'Failed to delete person', detail: err.message }, { status: 500 });
  }
} // end of DELETE
