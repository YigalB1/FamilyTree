export interface Person {
  id:          string;
  firstName:   string;
  lastName:    string;
  firstNameEn: string;
  lastNameEn:  string;
  firstNameHe: string;
  lastNameHe:  string;
  sex:         string;
  birthDate:   string;
  birthPlace:  string;
  deathDate:   string;
  deathPlace:  string;
  photoUrl:    string;
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

export function parseGedcom(text: string): GedcomData {
  const lines   = text.split(/\r?\n/);
  const persons:  Person[] = [];
  const families: Family[] = [];

  let currentPerson: Partial<Person> | null = null;
  let currentFamily: Partial<Family> | null = null;
  let nameCount      = 0;
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

    // ── Level 0 — new record ──────────────────────────────────
    if (level === 0) {

      // Save pending photo if we were in an OBJE block with a FILE url
      // (handles cases where FORM tag may be missing)
      if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
        currentPerson.photoUrl = pendingFileUrl;
      } // end if pending photo

      // Save previous record
      if (currentPerson) persons.push(currentPerson as Person);
      if (currentFamily) families.push(currentFamily as Family);

      // Reset all state
      currentPerson  = null;
      currentFamily  = null;
      nameCount      = 0;
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
      } // end if INDI/FAM

    // ── Level 1 ───────────────────────────────────────────────
    } else if (level === 1) {

      // Update sub-block flags
      inBirt = tag === 'BIRT';
      inDeat = tag === 'DEAT';
      inMarr = tag === 'MARR';

      // When entering a new OBJE block, reset pending URL
      if (tag === 'OBJE') {
        inObje         = true;
        pendingFileUrl = '';
      } else {
        // Any other level-1 tag ends the OBJE block
        // Save pending photo before leaving OBJE
        if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
          currentPerson.photoUrl = pendingFileUrl;
          pendingFileUrl = '';
        } // end if save pending
        inObje = false;
      } // end if OBJE

      if (currentPerson) {
        if (tag === 'NAME') {
          nameCount++;
          const nameParts = value.split('/');
          const first     = nameParts[0]?.trim() || '';
          const last      = nameParts[1]?.trim() || '';
          if (nameCount === 1) {
            // First NAME — English (Geni convention)
            currentPerson.firstName   = first;
            currentPerson.lastName    = last;
            currentPerson.firstNameEn = first;
            currentPerson.lastNameEn  = last;
          } else {
            // Second NAME — Hebrew
            currentPerson.firstNameHe = first;
            currentPerson.lastNameHe  = last;
          } // end if nameCount
        } // end if NAME
        if (tag === 'SEX') currentPerson.sex = value;
      } // end if currentPerson level 1

      if (currentFamily) {
        if (tag === 'HUSB') currentFamily.husbandId   = value.replace(/@/g, '');
        if (tag === 'WIFE') currentFamily.wifeId      = value.replace(/@/g, '');
        if (tag === 'CHIL') currentFamily.childrenIds = [
          ...(currentFamily.childrenIds || []), value.replace(/@/g, '')
        ];
        if (tag === 'DIV')  currentFamily.divorced = value === 'Y' || value === 'y';
      } // end if currentFamily level 1

    // ── Level 2 ───────────────────────────────────────────────
    } else if (level === 2) {

      if (currentPerson) {
        if (inBirt && tag === 'DATE')  currentPerson.birthDate  = value;
        if (inBirt && tag === 'PLAC')  currentPerson.birthPlace = value;
        if (inDeat && tag === 'DATE')  currentPerson.deathDate  = value;
        if (inDeat && tag === 'PLAC')  currentPerson.deathPlace = value;

        // Hebrew language marker — confirms second NAME is Hebrew
        if (tag === 'LANG' && value.toLowerCase() === 'hebrew') {
          // Already assigned to firstNameHe/lastNameHe above — nothing extra needed
        } // end if LANG

        // Geni format: 1 OBJE / 2 FILE https://... / 3 FORM jpg
        if (inObje && tag === 'FILE' && value.startsWith('http')) {
          pendingFileUrl = value;
        } // end if FILE url
      } // end if currentPerson level 2

      if (currentFamily) {
        if (inMarr && tag === 'DATE') currentFamily.marriageDate  = value;
        if (inMarr && tag === 'PLAC') currentFamily.marriagePlace = value;
      } // end if currentFamily level 2

    // ── Level 3 ───────────────────────────────────────────────
    } else if (level === 3) {

      if (currentPerson && inObje) {
        // Geni puts FORM at level 3: 1 OBJE / 2 FILE url / 3 FORM jpg
        if (tag === 'FORM' && pendingFileUrl) {
          const fmt = value.toLowerCase().trim();
          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fmt)) {
            if (!currentPerson.photoUrl) {
              currentPerson.photoUrl = pendingFileUrl;
            } // end if no photo yet
          } // end if image format
          pendingFileUrl = ''; // consumed
        } // end if FORM
      } // end if currentPerson level 3

    } // end if level
  } // end for lines

  // ── Save last record ──────────────────────────────────────────
  if (inObje && pendingFileUrl && currentPerson && !currentPerson.photoUrl) {
    currentPerson.photoUrl = pendingFileUrl;
  } // end if pending photo
  if (currentPerson) persons.push(currentPerson as Person);
  if (currentFamily) families.push(currentFamily as Family);

  return { persons, families };
} // end of parseGedcom
