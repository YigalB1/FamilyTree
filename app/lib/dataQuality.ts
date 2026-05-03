import pool from './db/client';

export type Severity = 'error' | 'warning' | 'info';

export interface QualityIssue {
  personId:   string;
  personName: string;
  geniId:     string;
  test:       string;
  detail:     string;
  severity:   Severity;
} // end of QualityIssue interface

export interface QualityResult {
  errors:        QualityIssue[];
  warnings:      QualityIssue[];
  infos:         QualityIssue[];
  totalPeople:   number;
  totalFamilies: number;
  scannedAt:     string;
} // end of QualityResult interface

// ── Helpers ───────────────────────────────────────────────────────

function parseYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0]) : null;
} // end of parseYear

function parseDateObj(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const months: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const parts = dateStr.toUpperCase().trim().split(/\s+/);
  if (parts.length === 3) {
    const day   = parseInt(parts[0]);
    const month = months[parts[1]];
    const year  = parseInt(parts[2]);
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day);
    } // end if parseable
  } // end if 3 parts
  const year = parseYear(dateStr);
  return year ? new Date(year, 6, 1) : null;
} // end of parseDateObj

function personDisplayName(p: any): string {
  const he = `${p.first_name_he || ''} ${p.last_name_he || ''}`.trim();
  const en = `${p.first_name_en || ''} ${p.last_name_en || ''}`.trim();
  return he || en || `ID: ${p.id.slice(0, 8)}`;
} // end of personDisplayName

const CURRENT_YEAR = new Date().getFullYear();

// ── Main scan function ────────────────────────────────────────────

export async function runDataQualityChecks(): Promise<QualityResult> {
  const issues: QualityIssue[] = [];

  // Load all data
  const personsResult  = await pool.query('SELECT * FROM persons');
  const familiesResult = await pool.query('SELECT * FROM families');
  const childrenResult = await pool.query('SELECT family_id, child_id FROM family_children');

  const persons  = personsResult.rows;
  const families = familiesResult.rows;

  // Build lookup maps
  const personMap: Record<string, any> = {};
  for (const p of persons) personMap[p.id] = p;

  // family_id → [child_ids]
  const childrenMap: Record<string, string[]> = {};
  for (const row of childrenResult.rows) {
    if (!childrenMap[row.family_id]) childrenMap[row.family_id] = [];
    childrenMap[row.family_id].push(row.child_id);
  } // end for children

  // person_id → [family_ids as spouse]
  const spouseFamilies: Record<string, string[]> = {};
  // person_id → [family_ids as child]
  const childFamilies: Record<string, string[]>  = {};

  for (const f of families) {
    if (f.husband_id) {
      if (!spouseFamilies[f.husband_id]) spouseFamilies[f.husband_id] = [];
      spouseFamilies[f.husband_id].push(f.id);
    } // end if husband
    if (f.wife_id) {
      if (!spouseFamilies[f.wife_id]) spouseFamilies[f.wife_id] = [];
      spouseFamilies[f.wife_id].push(f.id);
    } // end if wife
  } // end for families

  for (const row of childrenResult.rows) {
    if (!childFamilies[row.child_id]) childFamilies[row.child_id] = [];
    childFamilies[row.child_id].push(row.family_id);
  } // end for child families

  // Track which person+test combos already added to avoid duplicates
  const addedIssues = new Set<string>();

  function addIssue(p: any, test: string, detail: string, severity: Severity) {
    const key = `${p.id}|${test}`;
    if (addedIssues.has(key)) return; // skip if already added
    addedIssues.add(key);
    issues.push({
      personId:   p.id,
      personName: personDisplayName(p),
      geniId:     p.geni_id || '',
      test, detail, severity,
    });
  } // end of addIssue

  // ── Run checks on each person ─────────────────────────────────
  for (const p of persons) {
    const birthYear = parseYear(p.birth_date);
    const deathYear = parseYear(p.death_date);
    const isAlive   = !p.death_date;
    const name      = personDisplayName(p);

    // ── Test: unconnected profile ─────────────────────────────
    const hasSpouseFamily = (spouseFamilies[p.id] || []).length > 0;
    const hasChildFamily  = (childFamilies[p.id]  || []).length > 0;
    if (!hasSpouseFamily && !hasChildFamily) {
      addIssue(p, 'Unconnected profile',
        `${name} has no family connections`, 'warning');
    } // end if unconnected

    // ── Test: born after death ────────────────────────────────
    if (birthYear && deathYear && birthYear > deathYear) {
      addIssue(p, 'Born after death',
        `Birth year ${birthYear} is after death year ${deathYear}`, 'error');
    } // end if born after death

    // ── Test: future birth date ───────────────────────────────
    if (birthYear && birthYear > CURRENT_YEAR) {
      addIssue(p, 'Future birth date',
        `Birth year ${birthYear} is in the future`, 'error');
    } // end if future birth

    // ── Test: suspiciously old ────────────────────────────────
    if (isAlive && birthYear && (CURRENT_YEAR - birthYear) > 110) {
      addIssue(p, 'Suspiciously old',
        `${name} appears to be ${CURRENT_YEAR - birthYear} years old and marked as alive`,
        'warning');
    } // end if suspiciously old

    // ── Test: missing Hebrew name ─────────────────────────────
    if (!p.first_name_he && !p.last_name_he) {
      addIssue(p, 'Missing Hebrew name', `No Hebrew name recorded`, 'info');
    } // end if missing hebrew

    // ── Test: missing English name ────────────────────────────
    if (!p.first_name_en && !p.last_name_en) {
      addIssue(p, 'Missing English name', `No English name recorded`, 'info');
    } // end if missing english

    // ── Test: missing birth date ──────────────────────────────
    if (!p.birth_date) {
      addIssue(p, 'Missing birth date', `No birth date recorded`, 'info');
    } // end if missing birth date
  } // end for persons

  // ── Run checks on families ────────────────────────────────────
  for (const f of families) {
    const husband  = f.husband_id ? personMap[f.husband_id] : null;
    const wife     = f.wife_id    ? personMap[f.wife_id]    : null;
    const children = (childrenMap[f.id] || []).map((id: string) => personMap[id]).filter(Boolean);

    for (const child of children) {
      const childBirthYear = parseYear(child.birth_date);
      if (!childBirthYear) continue;

      for (const parent of [husband, wife].filter(Boolean)) {
        const parentBirthYear = parseYear(parent.birth_date);
        if (!parentBirthYear) continue;

        const ageAtBirth = childBirthYear - parentBirthYear;
        const parentName = personDisplayName(parent);
        const childName  = personDisplayName(child);
        const relation   = parent.id === f.husband_id ? 'Father' : 'Mother';

        // Child older than parent
        if (ageAtBirth < 0) {
          addIssue(child, 'Child older than parent',
            `${childName} (b.${childBirthYear}) is older than ${relation} ${parentName} (b.${parentBirthYear})`,
            'error');
        } // end if child older

        // Parent too young
        if (ageAtBirth >= 0 && ageAtBirth < 13) {
          addIssue(child, 'Parent too young at birth',
            `${relation} ${parentName} was only ${ageAtBirth} years old at birth of ${childName}`,
            'error');
        } // end if parent too young

        // Father too old
        if (relation === 'Father' && ageAtBirth > 80) {
          addIssue(child, 'Father too old at birth',
            `Father ${parentName} was ${ageAtBirth} years old at birth of ${childName}`,
            'warning');
        } // end if father too old

        // Mother too old
        if (relation === 'Mother' && ageAtBirth > 55) {
          addIssue(child, 'Mother too old at birth',
            `Mother ${parentName} was ${ageAtBirth} years old at birth of ${childName}`,
            'warning');
        } // end if mother too old
      } // end for parents
    } // end for children
  } // end for families

  // ── Test: possible duplicates ─────────────────────────────────
  // Group by English name + birth year (case-insensitive)
  // Use UUID as key to avoid double-reporting Hebrew/English variants
  const nameYearGroups: Record<string, string[]> = {}; // key → [person UUIDs]

  for (const p of persons) {
    const en   = `${p.first_name_en || ''} ${p.last_name_en || ''}`.trim().toLowerCase();
    const year = parseYear(p.birth_date);
    if (!en || !year) continue;
    const key = `${en}|${year}`;
    if (!nameYearGroups[key]) nameYearGroups[key] = [];
    // Only add UUID once per person
    if (!nameYearGroups[key].includes(p.id)) {
      nameYearGroups[key].push(p.id);
    } // end if not already added
  } // end for persons

  for (const [, uuids] of Object.entries(nameYearGroups)) {
    if (uuids.length > 1) {
      // Report each unique person once
      for (const uuid of uuids) {
        const p = personMap[uuid];
        if (p) {
          addIssue(p, 'Possible duplicate',
            `${uuids.length} people found with same English name and birth year`,
            'warning');
        } // end if person exists
      } // end for uuids
    } // end if duplicates
  } // end for nameYearGroups

  // ── Categorise by severity ────────────────────────────────────
  const errors   = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos    = issues.filter(i => i.severity === 'info');

  return {
    errors,
    warnings,
    infos,
    totalPeople:   persons.length,
    totalFamilies: families.length,
    scannedAt:     new Date().toISOString(),
  };
} // end of runDataQualityChecks
