import { GedcomData, Person } from '../parseGedcom';

export function getBothNames(person: Person): string {
  const he = `${person.firstNameHe || ''} ${person.lastNameHe || ''}`.trim();
  const en = `${person.firstNameEn || ''} ${person.lastNameEn || ''}`.trim();
  if (he && en) return `${he} / ${en}`;
  return he || en;
}

export function parseYear(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.trim().split(' ');
  const year  = parseInt(parts[parts.length - 1]);
  return isNaN(year) ? null : year;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function isAlive(person: Person): boolean {
  return !person.deathDate;
}

export function getAge(person: Person): number | null {
  const birthYear = parseYear(person.birthDate);
  if (!birthYear) return null;
  const deathYear = parseYear(person.deathDate) || currentYear();
  return deathYear - birthYear;
}

export function getSpouseNames(person: Person, data: GedcomData): string {
  const families = data.families.filter(
    f => f.husbandId === person.id || f.wifeId === person.id
  );
  return families
    .map(f => {
      const spouseId = f.husbandId === person.id ? f.wifeId : f.husbandId;
      const spouse   = data.persons.find(p => p.id === spouseId);
      return spouse ? getBothNames(spouse) : '';
    })
    .filter(Boolean)
    .join(', ');
}

export function getParentNames(person: Person, data: GedcomData): string {
  const family = data.families.find(f => f.childrenIds.includes(person.id));
  if (!family) return '';
  const parts: string[] = [];
  if (family.husbandId) {
    const p = data.persons.find(x => x.id === family.husbandId);
    if (p) parts.push(getBothNames(p));
  }
  if (family.wifeId) {
    const p = data.persons.find(x => x.id === family.wifeId);
    if (p) parts.push(getBothNames(p));
  }
  return parts.join(' & ');
}

export function getChildrenNames(person: Person, data: GedcomData): string {
  const families = data.families.filter(
    f => f.husbandId === person.id || f.wifeId === person.id
  );
  return families
    .flatMap(f => f.childrenIds)
    .map(cid => data.persons.find(p => p.id === cid))
    .filter((p): p is Person => !!p)
    .map(c => getBothNames(c))
    .join(', ');
}