// app/api/persons/[id]/roster/route.ts
// Generates a roster PDF of all descendants of a person.
// Called with GET /api/persons/[id]/roster

import { NextRequest, NextResponse } from 'next/server';
import { execFile }                  from 'child_process';
import { promisify }                 from 'util';
import { readFile, unlink }          from 'fs/promises';
import path                          from 'path';
import { randomUUID }                from 'crypto';
import pool                          from '@/app/lib/db/client';

const execFileAsync = promisify(execFile);
const PYTHON        = process.platform === 'win32' ? 'python' : 'python3';

// ── Walk descendants in BFS order, numbering from 1 ──────────────
// Returns flat ordered list matching buildDescendantTree

interface RosterPerson {
  number:      number;
  id:          string;
  firstNameHe: string;
  lastNameHe:  string;
  firstNameEn: string;
  lastNameEn:  string;
  birthDate:   string;
  deathDate:   string;
  fatherHe:    string;
  fatherEn:    string;
  motherHe:    string;
  motherEn:    string;
} // end of RosterPerson interface

async function buildRosterList(rootId: string): Promise<RosterPerson[]> {

  // 1. Load all persons and families from DB
  const [personsResult, familiesResult] = await Promise.all([
    pool.query(`
      SELECT id,
             COALESCE(first_name_he, '') AS first_name_he,
             COALESCE(last_name_he,  '') AS last_name_he,
             COALESCE(first_name_en, '') AS first_name_en,
             COALESCE(last_name_en,  '') AS last_name_en,
             COALESCE(birth_date,    '') AS birth_date,
             COALESCE(death_date,    '') AS death_date
      FROM persons
    `),
    pool.query(`
      SELECT id, husband_id, wife_id,
             ARRAY(
               SELECT child_id FROM family_children
               WHERE family_id = families.id
               ORDER BY child_id
             ) AS children_ids
      FROM families
    `),
  ]);

  // Index persons by id
  const personMap = new Map<string, any>();
  for (const p of personsResult.rows) {
    personMap.set(p.id, p);
  } // end for persons

  // Index families by id, and build child→parents map
  const childToParents = new Map<string, { fatherId: string; motherId: string }>();
  const personChildren  = new Map<string, string[]>(); // personId → childIds

  for (const f of familiesResult.rows) {
    const childIds: string[] = f.children_ids || [];
    for (const cid of childIds) {
      childToParents.set(cid, {
        fatherId: f.husband_id || '',
        motherId: f.wife_id    || '',
      });
    } // end for children

    // All children of husband and wife combined
    if (f.husband_id) {
      const existing = personChildren.get(f.husband_id) || [];
      personChildren.set(f.husband_id, [...existing, ...childIds]);
    } // end if husband
    if (f.wife_id) {
      const existing = personChildren.get(f.wife_id) || [];
      personChildren.set(f.wife_id, [...existing, ...childIds]);
    } // end if wife
  } // end for families

  // 2. BFS from root — same order as buildDescendantTree
  const visited = new Set<string>();
  const queue: string[] = [rootId];
  const ordered: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    ordered.push(id);
    const children = personChildren.get(id) || [];
    // Deduplicate children (person may appear via husband and wife)
    for (const cid of children) {
      if (!visited.has(cid)) queue.push(cid);
    } // end for children
  } // end while queue

  // 3. Build roster entries
  const result: RosterPerson[] = [];
  let num = 1;

  for (const id of ordered) {
    const p = personMap.get(id);
    if (!p) continue;

    const parents = childToParents.get(id);
    let fatherHe = '', fatherEn = '', motherHe = '', motherEn = '';

    if (parents?.fatherId) {
      const father = personMap.get(parents.fatherId);
      if (father) {
        fatherHe = `${father.first_name_he} ${father.last_name_he}`.trim();
        fatherEn = `${father.first_name_en} ${father.last_name_en}`.trim();
      } // end if father found
    } // end if fatherId

    if (parents?.motherId) {
      const mother = personMap.get(parents.motherId);
      if (mother) {
        motherHe = `${mother.first_name_he} ${mother.last_name_he}`.trim();
        motherEn = `${mother.first_name_en} ${mother.last_name_en}`.trim();
      } // end if mother found
    } // end if motherId

    result.push({
      number:      num++,
      id,
      firstNameHe: p.first_name_he,
      lastNameHe:  p.last_name_he,
      firstNameEn: p.first_name_en,
      lastNameEn:  p.last_name_en,
      birthDate:   p.birth_date,
      deathDate:   p.death_date,
      fatherHe, fatherEn, motherHe, motherEn,
    });
  } // end for ordered

  return result;
} // end of buildRosterList

// ── GET handler ───────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Get root person name for title
    const rootResult = await pool.query(
      `SELECT COALESCE(first_name_he,'') AS fhe,
              COALESCE(last_name_he, '') AS lhe,
              COALESCE(first_name_en,'') AS fen,
              COALESCE(last_name_en, '') AS len
       FROM persons WHERE id = $1`,
      [id]
    );

    if (rootResult.rows.length === 0) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    } // end if not found

    const r         = rootResult.rows[0];
    const rootName  = `${r.fhe || r.fen} ${r.lhe || r.len}`.trim();

    // Build person list
    const persons   = await buildRosterList(id);

    // Write to temp file and call Python
    const tmpPath    = path.join(require('os').tmpdir(), `roster-${randomUUID()}.pdf`);
    const scriptPath = path.join(process.cwd(), 'scripts', 'generate_roster.py');

    await execFileAsync(
      PYTHON,
      [scriptPath, tmpPath, JSON.stringify(persons), rootName],
      { timeout: 30000 }
    );

    const pdfBuffer = await readFile(tmpPath);
    await unlink(tmpPath).catch(() => {});

    const filename = `family-roster-${(r.lhe || r.len || 'tree').replace(/\s+/g, '-')}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(pdfBuffer.length),
      },
    });

  } catch (error: any) {
    console.error('Roster generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate roster', detail: error.message },
      { status: 500 }
    );
  } // end try/catch
} // end of GET
