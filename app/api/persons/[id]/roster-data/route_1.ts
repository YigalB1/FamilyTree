// app/api/persons/[id]/roster-data/route.ts
// Returns roster data as JSON — consumed by the frontend
// to append roster pages to the tree PDF.

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/app/lib/db/client';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const rootId = params.id;

  try {
    // Load all persons and families
    const [pr, fr] = await Promise.all([
      pool.query(`
        SELECT id,
               COALESCE(first_name_he,'') AS fhe,
               COALESCE(last_name_he, '') AS lhe,
               COALESCE(first_name_en,'') AS fen,
               COALESCE(last_name_en, '') AS len,
               COALESCE(birth_date,   '') AS birth_date,
               COALESCE(death_date,   '') AS death_date
        FROM persons
      `),
      pool.query(`
        SELECT husband_id, wife_id,
               ARRAY(
                 SELECT child_id FROM family_children
                 WHERE family_id = families.id
               ) AS children_ids
        FROM families
      `),
    ]);

    // Index
    const personMap     = new Map<string, any>();
    const childParents  = new Map<string, { fatherId: string; motherId: string }>();
    const personKids    = new Map<string, Set<string>>();

    for (const p of pr.rows) {
      personMap.set(p.id, p);
    }

    for (const f of fr.rows) {
      const kids: string[] = f.children_ids || [];
      for (const cid of kids) {
        childParents.set(cid, {
          fatherId: f.husband_id || '',
          motherId: f.wife_id    || '',
        });
      }
      for (const pid of [f.husband_id, f.wife_id]) {
        if (!pid) continue;
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
      ordered.push(id);
      const kids = personKids.get(id) || new Set<string>();
      for (const cid of kids) {
        if (!visited.has(cid)) queue.push(cid);
      }
    }

    // Build result
    const entries = ordered.map((id, idx) => {
      const p = personMap.get(id);
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

    // Also return root name for title
    const root     = personMap.get(rootId);
    const rootName = root
      ? `${root.fhe || root.fen} ${root.lhe || root.len}`.trim()
      : '';

    return NextResponse.json({ entries, rootName });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
} // end of GET
