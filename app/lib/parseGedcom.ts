export interface Person {
  id: string;
  // Primary display name (Hebrew if exists, else English)
  firstName: string;
  lastName: string;
  // Both languages stored separately
  firstNameEn: string;
  lastNameEn: string;
  firstNameHe: string;
  lastNameHe: string;
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
  let inBirt = false;
  let inDeat = false;
  let inMarr = false;
  let nameCount = 0; // track how many NAME tags we've seen

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const level = parseInt(parts[0]);
    const tag   = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === 0) {
      // Save previous record
      if (currentPerson) {
        // Set primary display name:
        // if Hebrew name exists use it, otherwise fall back to English
        const hasHebrew = (currentPerson.firstNameHe || '').length > 0;
        currentPerson.firstName = hasHebrew
          ? currentPerson.firstNameHe!
          : currentPerson.firstNameEn || '';
        currentPerson.lastName = hasHebrew
          ? currentPerson.lastNameHe!
          : currentPerson.lastNameEn || '';
        persons.push(currentPerson as Person);
      }
      if (currentFamily) families.push(currentFamily as Family);

      currentPerson = null;
      currentFamily = null;
      inBirt = false;
      inDeat = false;
      inMarr = false;
      nameCount = 0;

      if (parts[2] === 'INDI') {
        currentPerson = {
          id: tag.replace(/@/g, ''),
          firstName: '', lastName: '',
          firstNameEn: '', lastNameEn: '',
          firstNameHe: '', lastNameHe: '',
          sex: '',
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

      if (currentPerson) {
        if (tag === 'NAME') {
          nameCount++;
          const nameParts  = value.split('/');
          const first      = nameParts[0]?.trim() || '';
          const last       = nameParts[1]?.trim() || '';
          const isHebrew   = /[\u0590-\u05FF]/.test(first + last);

          if (nameCount === 1) {
            // First NAME tag
            if (isHebrew) {
              currentPerson.firstNameHe = first;
              currentPerson.lastNameHe  = last;
            } else {
              currentPerson.firstNameEn = first;
              currentPerson.lastNameEn  = last;
            }
          } else {
            // Second NAME tag — opposite language
            if (isHebrew) {
              currentPerson.firstNameHe = first;
              currentPerson.lastNameHe  = last;
            } else {
              currentPerson.firstNameEn = first;
              currentPerson.lastNameEn  = last;
            }
          }
        }
        if (tag === 'SEX') currentPerson.sex = value;
      }

      if (currentFamily) {
        if (tag === 'HUSB') currentFamily.husbandId = value.replace(/@/g, '');
        if (tag === 'WIFE') currentFamily.wifeId    = value.replace(/@/g, '');
        if (tag === 'CHIL') currentFamily.childrenIds = [
          ...(currentFamily.childrenIds || []),
          value.replace(/@/g, ''),
        ];
      }
    } else if (level === 2) {
      if (currentPerson) {
        if (inBirt && tag === 'DATE') currentPerson.birthDate  = value;
        if (inBirt && tag === 'PLAC') currentPerson.birthPlace = value;
        if (inDeat && tag === 'DATE') currentPerson.deathDate  = value;
        if (inDeat && tag === 'PLAC') currentPerson.deathPlace = value;
      }
      if (currentFamily) {
        if (inMarr && tag === 'DATE') currentFamily.marriageDate  = value;
        if (inMarr && tag === 'PLAC') currentFamily.marriagePlace = value;
      }
    }
  }

  // Push last record
  if (currentPerson) {
    const hasHebrew = (currentPerson.firstNameHe || '').length > 0;
    currentPerson.firstName = hasHebrew
      ? currentPerson.firstNameHe!
      : currentPerson.firstNameEn || '';
    currentPerson.lastName = hasHebrew
      ? currentPerson.lastNameHe!
      : currentPerson.lastNameEn || '';
    persons.push(currentPerson as Person);
  }
  if (currentFamily) families.push(currentFamily as Family);

  return { persons, families };
}