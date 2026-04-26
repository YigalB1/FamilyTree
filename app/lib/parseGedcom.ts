export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  sex: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
}

export interface Family {
  id: string;
  husbandId: string;
  wifeId: string;
  childrenIds: string[];
  marriageDate: string;
  marriagePlace: string;
}

export interface GedcomData {
  persons: Person[];
  families: Family[];
}

export function parseGedcom(text: string): GedcomData {
  const lines = text.split(/\r?\n/);
  const persons: Person[] = [];
  const families: Family[] = [];

  let currentPerson: Partial<Person> | null = null;
  let currentFamily: Partial<Family> | null = null;
  let currentTag = '';
  let inBirt = false;
  let inDeat = false;
  let inMarr = false;

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const level = parseInt(parts[0]);
    const tag = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === 0) {
      // Save previous record
      if (currentPerson) persons.push(currentPerson as Person);
      if (currentFamily) families.push(currentFamily as Family);
      currentPerson = null;
      currentFamily = null;
      inBirt = false;
      inDeat = false;
      inMarr = false;

      if (parts[2] === 'INDI') {
        currentPerson = {
          id: tag.replace(/@/g, ''),
          firstName: '', lastName: '', sex: '',
          birthDate: '', birthPlace: '',
          deathDate: '', deathPlace: '',
        };
      } else if (parts[2] === 'FAM') {
        currentFamily = {
          id: tag.replace(/@/g, ''),
          husbandId: '', wifeId: '',
          childrenIds: [],
          marriageDate: '', marriagePlace: '',
        };
      }
    } else if (level === 1) {
      inBirt = tag === 'BIRT';
      inDeat = tag === 'DEAT';
      inMarr = tag === 'MARR';
      currentTag = tag;

      if (currentPerson) {
        if (tag === 'NAME') {
          const nameParts = value.split('/');
          currentPerson.firstName = nameParts[0]?.trim() || '';
          currentPerson.lastName = nameParts[1]?.trim() || '';
        }
        if (tag === 'SEX') currentPerson.sex = value;
      }

      if (currentFamily) {
        if (tag === 'HUSB') currentFamily.husbandId = value.replace(/@/g, '');
        if (tag === 'WIFE') currentFamily.wifeId  = value.replace(/@/g, '');
        if (tag === 'CHIL') currentFamily.childrenIds = [...(currentFamily.childrenIds || []), value.replace(/@/g, '')];
      }
    } else if (level === 2) {
      if (currentPerson) {
        if (inBirt && tag === 'DATE')  currentPerson.birthDate  = value;
        if (inBirt && tag === 'PLAC')  currentPerson.birthPlace = value;
        if (inDeat && tag === 'DATE')  currentPerson.deathDate  = value;
        if (inDeat && tag === 'PLAC')  currentPerson.deathPlace = value;
      }
      if (currentFamily) {
        if (inMarr && tag === 'DATE')  currentFamily.marriageDate  = value;
        if (inMarr && tag === 'PLAC')  currentFamily.marriagePlace = value;
      }
    }
  }

  // Push last record
  if (currentPerson) persons.push(currentPerson as Person);
  if (currentFamily) families.push(currentFamily as Family);

  return { persons, families };
}