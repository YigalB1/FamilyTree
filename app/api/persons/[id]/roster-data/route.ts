// app/api/persons/[id]/roster-data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db/client';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const raw    = (await context.params).id;
  // Strip any accidental brackets e.g. "[uuid]" → "uuid"
  const rootId = raw.replace(/^\[/, '').replace(/\]$/, '');

  try {
    const pr = await pool.query(`
      SELECT id,
             COALESCE(first_name_he, '') AS fhe,
             COALESCE(last_name_he,  '') AS lhe,
             COALESCE(first_name_en, '') AS fen,
             COALESCE(last_name_en,  '') AS len,
             COALESCE(birth_date,    '') AS birth_date,
             COALESCE(death_date,    '') AS death_date
      FROM persons
    `);

    const fr = await pool.query(`
      SELECT f.husband_id, f.wife_id,
             ARRAY(
               SELECT fc.child_id::text
               FROM family_children fc
               WHERE fc.family_id = f.id
             ) AS children_ids
      FROM families f
    `);

    const personMap = new Map<string, any>();
    for (const p of pr.rows) personMap.set(p.id, p);

    const childParents = new Map<string, { fatherId: string; motherId: string }>();
    const personKids   = new Map<string, Set<string>>();

    for (const f of fr.rows) {
      const kids: string[] = f.children_ids || [];
      for (const cid of kids) {
        if (!childParents.has(cid)) {
          childParents.set(cid, {
            fatherId: f.husband_id || '',
            motherId: f.wife_id    || '',
          });
        }
      }
      for (const pid of [f.husband_id, f.wife_id].filter(Boolean)) {
        const s = personKids.get(pid) || new Set<string>();
        kids.forEach(c => s.add(c));
        personKids.set(pid, s);
      }
    }

    // BFS from root
    const visited = new Set<string>();
    const queue   = [rootId];
    const ordered: string[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (personMap.has(id)) ordered.push(id);
      const kids = personKids.get(id) || new Set<string>();
      for (const cid of kids) {
        if (!visited.has(cid)) queue.push(cid);
      }
    }

    const entries = ordered.map((id, idx) => {
      const p  = personMap.get(id);
      if (!p) return null;
      const par = childParents.get(id);
      const fa  = par?.fatherId ? personMap.get(par.fatherId) : null;
      const mo  = par?.motherId ? personMap.get(par.motherId) : null;
      return {
        number:      idx + 1,
        firstNameHe: p.fhe,
        lastNameHe:  p.lhe,
        firstNameEn: p.fen,
        lastNameEn:  p.len,
        birthDate:   p.birth_date,
        deathDate:   p.death_date,
        fatherHe:    fa ? `${fa.fhe} ${fa.lhe}`.trim() : '',
        fatherEn:    fa ? `${fa.fen} ${fa.len}`.trim() : '',
        motherHe:    mo ? `${mo.fhe} ${mo.lhe}`.trim() : '',
        motherEn:    mo ? `${mo.fen} ${mo.len}`.trim() : '',
      };
    }).filter(Boolean);

    const root     = personMap.get(rootId);
    const rootName = root
      ? `${root.fhe || root.fen} ${root.lhe || root.len}`.trim()
      : '';

    return NextResponse.json({ entries, rootName });

  } catch (err: any) {
    console.error('roster-data error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
