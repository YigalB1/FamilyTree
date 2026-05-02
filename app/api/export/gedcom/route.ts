import { getSession } from '../../../lib/auth';
import pool           from '../../../lib/db/client';

// ── GEDCOM formatting helpers ─────────────────────────────────────

function gedcomDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.toUpperCase();
} // end of gedcomDate

function sanitize(str: string): string {
  if (!str) return '';
  return str.replace(/[\r\n]+/g, ' ').trim();
} // end of sanitize

function gedcomId(uuid: string): string {
  return `I${uuid.replace(/-/g, '').substring(0, 16).toUpperCase()}`;
} // end of gedcomId

function gedcomFamId(uuid: string): string {
  return `F${uuid.replace(/-/g, '').substring(0, 16).toUpperCase()}`;
} // end of gedcomFamId

// ── Collect all descendant IDs from a root person ─────────────────

async function collectDescendantIds(
  rootId:      string,
  families:    any[],
  childrenMap: Record<string, string[]>
): Promise<Set<string>> {
  const ids     = new Set<string>();
  const queue   = [rootId];

  while (queue.length > 0) {
    const personId = queue.shift()!;
    if (ids.has(personId)) continue;
    ids.add(personId);

    // Find families where this person is a spouse
    for (const f of families) {
      if (f.husband_id === personId || f.wife_id === personId) {
        // Add spouse
        const spouseId = f.husband_id === personId ? f.wife_id : f.husband_id;
        if (spouseId && !ids.has(spouseId)) ids.add(spouseId);

        // Add children to queue
        const children = childrenMap[f.id] || [];
        for (const childId of children) {
          if (!ids.has(childId)) queue.push(childId);
        } // end for children
      } // end if spouse
    } // end for families
  } // end while queue

  return ids;
} // end of collectDescendantIds

// ── Main export handler ───────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const user = await getSession();
    if (!user)             return Response.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'viewer') return Response.json({ error: 'Permission denied' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const rootGeniId       = searchParams.get('rootId'); // Geni ID from localStorage person

    // Load all persons
    const personsResult = await pool.query('SELECT * FROM persons ORDER BY created_at');
    const allPersons    = personsResult.rows;

    // Load all families
    const familiesResult = await pool.query('SELECT * FROM families ORDER BY created_at');
    const allFamilies    = familiesResult.rows;

    // Load all family children
    const childrenResult = await pool.query('SELECT family_id, child_id FROM family_children');
    const childrenMap: Record<string, string[]> = {};
    for (const row of childrenResult.rows) {
      if (!childrenMap[row.family_id]) childrenMap[row.family_id] = [];
      childrenMap[row.family_id].push(row.child_id);
    } // end for children

    // ── Filter by root if provided ────────────────────────────────
    let persons  = allPersons;
    let families = allFamilies;

    if (rootGeniId) {
      // Find the root person by Geni ID or UUID
      const rootPerson = allPersons.find(
        p => p.geni_id === rootGeniId || p.id === rootGeniId
      );

      if (rootPerson) {
        const descendantIds = await collectDescendantIds(rootPerson.id, allFamilies, childrenMap);

        // Filter persons to descendants only
        persons = allPersons.filter(p => descendantIds.has(p.id));

        // Filter families — only include if at least one spouse is in descendants
        const personIdSet = new Set(persons.map(p => p.id));
        families = allFamilies.filter(f =>
          (f.husband_id && personIdSet.has(f.husband_id)) ||
          (f.wife_id    && personIdSet.has(f.wife_id))
        );
      } // end if rootPerson found
    } // end if rootGeniId

    // Build ID maps
    const personIdMap:  Record<string, string> = {};
    const familyIdMap:  Record<string, string> = {};
    for (const p of persons)  personIdMap[p.id]  = gedcomId(p.id);
    for (const f of families) familyIdMap[f.id]  = gedcomFamId(f.id);

    // ── Build GEDCOM lines ────────────────────────────────────────
    const lines: string[] = [];

    // Header
    lines.push('0 HEAD');
    lines.push('1 SOUR FamilyTreeApp');
    lines.push('2 NAME Family Tree Application');
    lines.push('2 VERS 1.0');
    lines.push('1 GEDC');
    lines.push('2 VERS 5.5');
    lines.push('2 FORM LINEAGE-LINKED');
    lines.push('1 CHAR UTF-8');
    lines.push(`1 DATE ${new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).toUpperCase()}`);
    lines.push('');

    // ── INDI records ──────────────────────────────────────────────
    for (const p of persons) {
      const gid = personIdMap[p.id];
      lines.push(`0 @${gid}@ INDI`);

      // English name first
      const enFirst = sanitize(p.first_name_en || '');
      const enLast  = sanitize(p.last_name_en  || '');
      if (enFirst || enLast) {
        lines.push(`1 NAME ${enFirst} /${enLast}/`);
      } // end if en name

      // Hebrew name second
      const heFirst = sanitize(p.first_name_he || '');
      const heLast  = sanitize(p.last_name_he  || '');
      if (heFirst || heLast) {
        lines.push(`1 NAME ${heFirst} /${heLast}/`);
        lines.push('2 LANG Hebrew');
      } // end if he name

      // Sex
      if (p.sex === 'M')      lines.push('1 SEX M');
      else if (p.sex === 'F') lines.push('1 SEX F');

      // Birth
      if (p.birth_date || p.birth_place) {
        lines.push('1 BIRT');
        if (p.birth_date)  lines.push(`2 DATE ${gedcomDate(p.birth_date)}`);
        if (p.birth_place) lines.push(`2 PLAC ${sanitize(p.birth_place)}`);
      } // end if birth

      // Death
      if (p.death_date || p.death_place) {
        lines.push('1 DEAT');
        if (p.death_date)  lines.push(`2 DATE ${gedcomDate(p.death_date)}`);
        if (p.death_place) lines.push(`2 PLAC ${sanitize(p.death_place)}`);
      } // end if death

      // Notes
      if (p.notes) {
        const noteLines = sanitize(p.notes).match(/.{1,248}/g) || [];
        noteLines.forEach((chunk, i) => {
          lines.push(`${i === 0 ? '1 NOTE' : '2 CONT'} ${chunk}`);
        });
      } // end if notes

      // Geni source reference
      if (p.geni_id) lines.push(`1 REFN ${p.geni_id}`);

      // FAMS — families where this person is a spouse
      for (const f of families) {
        if (f.husband_id === p.id || f.wife_id === p.id) {
          lines.push(`1 FAMS @${familyIdMap[f.id]}@`);
        } // end if spouse
      } // end for fams

      // FAMC — families where this person is a child
      for (const f of families) {
        const children = childrenMap[f.id] || [];
        if (children.includes(p.id)) {
          lines.push(`1 FAMC @${familyIdMap[f.id]}@`);
        } // end if child
      } // end for famc

      lines.push('');
    } // end for persons

    // ── FAM records ───────────────────────────────────────────────
    for (const f of families) {
      const fid = familyIdMap[f.id];
      lines.push(`0 @${fid}@ FAM`);

      if (f.husband_id && personIdMap[f.husband_id]) {
        lines.push(`1 HUSB @${personIdMap[f.husband_id]}@`);
      } // end if husband

      if (f.wife_id && personIdMap[f.wife_id]) {
        lines.push(`1 WIFE @${personIdMap[f.wife_id]}@`);
      } // end if wife

      // Marriage
      if (f.marriage_date || f.marriage_place) {
        lines.push('1 MARR');
        if (f.marriage_date)  lines.push(`2 DATE ${gedcomDate(f.marriage_date)}`);
        if (f.marriage_place) lines.push(`2 PLAC ${sanitize(f.marriage_place)}`);
      } // end if marriage

      // Divorce
      if (f.divorced) lines.push('1 DIV Y');

      // Children
      const children = childrenMap[f.id] || [];
      for (const childId of children) {
        if (personIdMap[childId]) {
          lines.push(`1 CHIL @${personIdMap[childId]}@`);
        } // end if child exists
      } // end for children

      // Geni source reference
      if (f.geni_id) lines.push(`1 REFN ${f.geni_id}`);

      lines.push('');
    } // end for families

    // Trailer
    lines.push('0 TRLR');

    // ── Build response ────────────────────────────────────────────
    const gedcomContent = lines.join('\r\n');
    const suffix        = rootGeniId ? '-partial' : '-full';
    const filename      = `familytree-export${suffix}-${new Date().toISOString().split('T')[0]}.ged`;

    return new Response(gedcomContent, {
      headers: {
        'Content-Type':        'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('GEDCOM export error:', err);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
} // end of GET
