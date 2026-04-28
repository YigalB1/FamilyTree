import * as XLSX from 'xlsx';
import { GedcomData, Person } from '../parseGedcom';
import { getBothNames, parseYear, currentYear } from './reportUtils';

interface Problem {
  ID:       string;
  Name:     string;
  Problem:  string;
  Severity: 'High' | 'Medium' | 'Low';
}

export function buildReport3(data: GedcomData): XLSX.WorkBook {
  const problems: Problem[] = [];
  const cy = currentYear();

  function add(person: Person, problem: string, severity: Problem['Severity']) {
    problems.push({ ID: person.id, Name: getBothNames(person), Problem: problem, Severity: severity });
  }

  data.persons.forEach(p => {
    // Missing names
    if (!p.firstName && !p.firstNameHe && !p.firstNameEn)
      add(p, 'Missing first name entirely', 'High');
    if (!p.lastName && !p.lastNameHe && !p.lastNameEn)
      add(p, 'Missing last name entirely', 'High');
    if (!p.firstNameHe && !p.lastNameHe)
      add(p, 'Missing Hebrew name', 'Medium');
    if (!p.firstNameEn && !p.lastNameEn)
      add(p, 'Missing English name', 'Medium');

    // Missing DOB
    if (!p.birthDate)
      add(p, 'Missing date of birth', 'Medium');

    // Missing sex
    if (!p.sex)
      add(p, 'Missing sex / gender', 'Low');

    // Likely deceased but no death date
    const birthYear = parseYear(p.birthDate);
    if (birthYear && !p.deathDate && (cy - birthYear) > 120)
      add(p, `Born ${birthYear} — likely deceased but no death date`, 'Medium');

    // No parents
    const hasParents = data.families.some(f => f.childrenIds.includes(p.id));
    if (!hasParents)
      add(p, 'No parents recorded', 'Low');

    // Isolated person
    const hasFamilies = data.families.some(f => f.husbandId === p.id || f.wifeId === p.id);
    if (!hasFamilies && !hasParents)
      add(p, 'Isolated — no parents, no spouse, no children', 'High');

    // Young / old parent checks
    const ownFamilies = data.families.filter(
      f => f.husbandId === p.id || f.wifeId === p.id
    );
    ownFamilies.forEach(fam => {
      fam.childrenIds.forEach(cid => {
        const child      = data.persons.find(x => x.id === cid);
        if (!child) return;
        const childYear  = parseYear(child.birthDate);
        const parentYear = parseYear(p.birthDate);
        if (childYear && parentYear) {
          const age = childYear - parentYear;
          if (age < 15)
            add(p, `Very young parent — age ${age} at birth of ${getBothNames(child)}`, 'High');
          if (age > 70)
            add(p, `Very old parent — age ${age} at birth of ${getBothNames(child)}`, 'Medium');
        }
      });

      // Marriage before own birth
      const marriageYear = parseYear(fam.marriageDate);
      if (marriageYear && birthYear && marriageYear < birthYear)
        add(p, `Marriage (${marriageYear}) before own birth (${birthYear})`, 'High');
    });

    // Child born before parent
    const parentFamily = data.families.find(f => f.childrenIds.includes(p.id));
    if (parentFamily && p.birthDate) {
      [parentFamily.husbandId, parentFamily.wifeId].forEach(pid => {
        const parent = data.persons.find(x => x.id === pid);
        if (!parent?.birthDate) return;
        const pYear = parseYear(parent.birthDate);
        const cYear = parseYear(p.birthDate);
        if (pYear && cYear && cYear < pYear)
          add(p, `Born before parent ${getBothNames(parent)}`, 'High');
      });
    }
  });

  // Sort by severity
  const order = { High: 0, Medium: 1, Low: 2 };
  problems.sort((a, b) => order[a.Severity] - order[b.Severity]);

  const high   = problems.filter(p => p.Severity === 'High').length;
  const medium = problems.filter(p => p.Severity === 'Medium').length;
  const low    = problems.filter(p => p.Severity === 'Low').length;

  const summary = [
    { Category: 'Total Problems',     Count: problems.length },
    { Category: 'High Severity',      Count: high            },
    { Category: 'Medium Severity',    Count: medium          },
    { Category: 'Low Severity',       Count: low             },
    { Category: 'Total People',       Count: data.persons.length },
    { Category: 'People with issues', Count: new Set(problems.map(p => p.ID)).size },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary),  'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(problems), 'Problems');
  return wb;
}