export interface Person {
  id: string;
  firstName: string;
  lastName: string;
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
  divorced: boolean;
}

export interface GedcomData {
  persons: Person[];
  families: Family[];
}

export function parseGedcom(text: string): GedcomData {
  const lines   = text.split(/\r?\n/);
  const persons: Person[] = [];
  const families: Family[] = [];

  let currentPerson: Partial<Person> | null = null;
  let currentFamily: Partial<Family> | null = null;
  let inBirt    = false;
  let inDeat    = false;
  let inMarr    = false;
  let nameCount = 0;

  function pushPerson() {
    if (!currentPerson) return;
    const hasHebrew = (currentPerson.firstNameHe || '').length > 0;
    currentPerson.firstName = hasHebrew
      ? currentPerson.firstNameHe!
      : currentPerson.firstNameEn || '';
    currentPerson.lastName = hasHebrew
      ? currentPerson.lastNameHe!
      : currentPerson.lastNameEn || '';
    persons.push(currentPerson as Person);
  }

  function pushFamily() {
    if (!currentFamily) return;
    // Mark as divorced if missing husband or wife
    currentFamily.divorced = !currentFamily.husbandId || !currentFamily.wifeId;
    families.push(currentFamily as Family);
  }

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const level = parseInt(parts[0]);
    const tag   = parts[1];
    const value = parts.slice(2).join(' ');

    if (level === 0) {
      pushPerson();
      pushFamily();
      currentPerson = null;
      currentFamily = null;
      inBirt        = false;
      inDeat        = false;
      inMarr        = false;
      nameCount     = 0;

      if (parts[2] === 'INDI') {
        currentPerson = {
          id:          tag.replace(/@/g, ''),
          firstName:   '', lastName:   '',
          firstNameEn: '', lastNameEn: '',
          firstNameHe: '', lastNameHe: '',
          sex:         '',
          birthDate:   '', birthPlace: '',
          deathDate:   '', deathPlace: '',
        };
      } else if (parts[2] === 'FAM') {
        currentFamily = {
          id:           tag.replace(/@/g, ''),
          husbandId:    '', wifeId: '',
          childrenIds:  [],
          marriageDate: '', marriagePlace: '',
          divorced:     false,
        };
      }

    } else if (level === 1) {
      inBirt = tag === 'BIRT';
      inDeat = tag === 'DEAT';
      inMarr = tag === 'MARR';

      if (currentPerson) {
        if (tag === 'NAME') {
          nameCount++;
          const nameParts = value.split('/');
          const first     = nameParts[0]?.trim() || '';
          const last      = nameParts[1]?.trim() || '';
          const isHebrew  = /[\u0590-\u05FF]/.test(first + last);

          if (isHebrew) {
            currentPerson.firstNameHe = first;
            currentPerson.lastNameHe  = last;
          } else {
            currentPerson.firstNameEn = first;
            currentPerson.lastNameEn  = last;
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

  // Push last records
  pushPerson();
  pushFamily();

  return { persons, families };
}