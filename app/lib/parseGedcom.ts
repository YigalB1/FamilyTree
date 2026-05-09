export interface Person {
  id:              string;
  firstName:       string;
  lastName:        string;
  firstNameEn:     string;
  lastNameEn:      string;
  firstNameHe:     string;
  lastNameHe:      string;
  birthLastNameEn: string;
  birthLastNameHe: string;
  sex:             string;
  birthDate:       string;
  birthPlace:      string;
  deathDate:       string;
  deathPlace:      string;
  photoUrl:        string;
} // end of Person interface

export interface Family {
  id:            string;
  husbandId:     string;
  wifeId:        string;
  childrenIds:   string[];
  marriageDate:  string;
  marriagePlace: string;
  divorced:      boolean;
} // end of Family interface

export interface GedcomData {
  persons:  Person[];
  families: Family[];
} // end of GedcomData interface

function isHebrewText(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
} // end of isHebrewText

export function parseGedcom(text: string): GedcomData {
  const lines   = text.split(/\r?\n/);
  const persons:  Person[] = [];
  const families: Family[] = [];

  let currentPerson: Partial<Person> | null = null;
  let currentFamily: Partial<Family> | null = null;
  let inBirt         = false;
  let inDeat         = false;
  let inMarr         = false;
  let inObje         = false;
  let pendingFileUrl = '';

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const level = parseInt(parts[0]);
    if (isNaN(level)) continue;
    const tag   = parts[1];
    const value = parts.slice(2).join(' ');

    // ── Level 0 ────────────────────────────────────────────────
    if (level === 0) {
      if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
        currentPerson.photoUrl = pendingFileUrl;
      }
      if (currentPerson) {
        // Resolve display names:
        // last_name = married name (_MARNM) if exists, else birth name
        // birth_last_name = birth name always
        currentPerson.firstName = currentPerson.firstNameEn || currentPerson.firstNameHe || '';
        currentPerson.lastName  = currentPerson.lastNameEn  || currentPerson.lastNameHe  || '';
        persons.push(currentPerson as Person);
      }
      if (currentFamily) families.push(currentFamily as Family);

      currentPerson  = null;
      currentFamily  = null;
      inBirt         = false;
      inDeat         = false;
      inMarr         = false;
      inObje         = false;
      pendingFileUrl = '';

      if (parts[2] === 'INDI') {
        currentPerson = {
          id: tag.replace(/@/g, ''),
          firstName: '', lastName: '',
          firstNameEn: '', lastNameEn: '',
          firstNameHe: '', lastNameHe: '',
          birthLastNameEn: '', birthLastNameHe: '',
          sex: '', birthDate: '', birthPlace: '',
          deathDate: '', deathPlace: '', photoUrl: '',
        };
      } else if (parts[2] === 'FAM') {
        currentFamily = {
          id: tag.replace(/@/g, ''),
          husbandId: '', wifeId: '',
          childrenIds: [],
          marriageDate: '', marriagePlace: '',
          divorced: false,
        };
      }

    // ── Level 1 ────────────────────────────────────────────────
    } else if (level === 1) {
      inBirt = tag === 'BIRT';
      inDeat = tag === 'DEAT';
      inMarr = tag === 'MARR';

      if (tag === 'OBJE') {
        inObje = true; pendingFileUrl = '';
      } else {
        if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
          currentPerson.photoUrl = pendingFileUrl;
          pendingFileUrl = '';
        }
        inObje = false;
      }

      if (currentPerson) {
        if (tag === 'NAME') {
          const nameParts = value.split('/');
          const first     = nameParts[0]?.trim() || '';
          const last      = nameParts[1]?.trim() || '';
          if (isHebrewText(first + last)) {
            if (!currentPerson.firstNameHe)     currentPerson.firstNameHe     = first;
            if (!currentPerson.lastNameHe)      currentPerson.lastNameHe      = last;
            if (!currentPerson.birthLastNameHe) currentPerson.birthLastNameHe = last;
          } else {
            if (!currentPerson.firstNameEn)     currentPerson.firstNameEn     = first;
            if (!currentPerson.lastNameEn)      currentPerson.lastNameEn      = last;
            if (!currentPerson.birthLastNameEn) currentPerson.birthLastNameEn = last;
          }
        } // end if NAME

        // _MARNM at level 1 (some GEDCOM variants)
        if (tag === '_MARNM') {
          if (isHebrewText(value)) {
            currentPerson.lastNameHe = value;
          } else {
            currentPerson.lastNameEn = value;
          }
        } // end if _MARNM

        if (tag === 'SEX') currentPerson.sex = value;
      } // end if currentPerson

      if (currentFamily) {
        if (tag === 'HUSB') currentFamily.husbandId   = value.replace(/@/g, '');
        if (tag === 'WIFE') currentFamily.wifeId      = value.replace(/@/g, '');
        if (tag === 'CHIL') currentFamily.childrenIds = [
          ...(currentFamily.childrenIds || []), value.replace(/@/g, '')
        ];
        if (tag === 'DIV')  currentFamily.divorced = value === 'Y' || value === 'y';
      }

    // ── Level 2 ────────────────────────────────────────────────
    } else if (level === 2) {
      if (currentPerson) {
        // _MARNM at level 2 — Geni puts married name under NAME tag
        if (tag === '_MARNM') {
          if (isHebrewText(value)) {
            currentPerson.lastNameHe = value;
          } else {
            currentPerson.lastNameEn = value;
          }
        } // end if _MARNM level 2
        if (inBirt && tag === 'DATE') currentPerson.birthDate  = value;
        if (inBirt && tag === 'PLAC') currentPerson.birthPlace = value;
        if (inDeat && tag === 'DATE') currentPerson.deathDate  = value;
        if (inDeat && tag === 'PLAC') currentPerson.deathPlace = value;
        if (inObje && tag === 'FILE' && value.startsWith('http')) {
          pendingFileUrl = value;
        }
      }
      if (currentFamily) {
        if (inMarr && tag === 'DATE') currentFamily.marriageDate  = value;
        if (inMarr && tag === 'PLAC') currentFamily.marriagePlace = value;
      }

    // ── Level 3 ────────────────────────────────────────────────
    } else if (level === 3) {
      if (currentPerson) {
        if (inObje && tag === 'FORM' && pendingFileUrl) {
          const fmt = value.toLowerCase().trim();
          if (['jpg','jpeg','png','webp','gif'].includes(fmt)) {
            if (!currentPerson.photoUrl) currentPerson.photoUrl = pendingFileUrl;
          }
          pendingFileUrl = '';
        }
        if (inBirt && tag === 'CITY' && !currentPerson.birthPlace) currentPerson.birthPlace = value;
        if (inDeat && tag === 'CITY' && !currentPerson.deathPlace) currentPerson.deathPlace = value;
        if (inBirt && tag === 'CTRY' && !currentPerson.birthPlace) currentPerson.birthPlace = value;
        if (inDeat && tag === 'CTRY' && !currentPerson.deathPlace) currentPerson.deathPlace = value;
      }
    }
  } // end for lines

  // Save last record
  if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
    currentPerson.photoUrl = pendingFileUrl;
  }
  if (currentPerson) {
    currentPerson.firstName = currentPerson.firstNameEn || currentPerson.firstNameHe || '';
    currentPerson.lastName  = currentPerson.lastNameEn  || currentPerson.lastNameHe  || '';
    persons.push(currentPerson as Person);
  }
  if (currentFamily) families.push(currentFamily as Family);

  return { persons, families };
} // end of parseGedcom
