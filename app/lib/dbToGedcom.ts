import { GedcomData, Person, Family } from './parseGedcom';

export interface DbPerson {
  id:            string;
  geni_id:       string;
  first_name_he: string;
  last_name_he:  string;
  first_name_en: string;
  last_name_en:  string;
  sex:           string;
  birth_date:    string;
  birth_place:   string;
  death_date:    string;
  death_place:   string;
  notes:         string;
  photo_url:     string; // ← Geni photo URL
} // end of DbPerson interface

export interface DbFamily {
  id:             string;
  geni_id:        string;
  husband_id:     string;
  wife_id:        string;
  marriage_date:  string;
  marriage_place: string;
  divorced:       boolean;
  children_ids:   string[];
} // end of DbFamily interface

export function dbToGedcomData(
  dbPersons:  DbPerson[],
  dbFamilies: DbFamily[]
): GedcomData {

  const persons: Person[] = dbPersons.map(p => ({
    id:          p.id,
    firstName:   p.first_name_en || p.first_name_he || '',
    lastName:    p.last_name_en  || p.last_name_he  || '',
    firstNameEn: p.first_name_en || '',
    lastNameEn:  p.last_name_en  || '',
    firstNameHe: p.first_name_he || '',
    lastNameHe:  p.last_name_he  || '',
    sex:         p.sex           || '',
    birthDate:   p.birth_date    || '',
    birthPlace:  p.birth_place   || '',
    deathDate:   p.death_date    || '',
    deathPlace:  p.death_place   || '',
    photoUrl:    p.photo_url     || '',
  })); // end persons map

  const families: Family[] = dbFamilies.map(f => ({
    id:            f.id,
    husbandId:     f.husband_id    || '',
    wifeId:        f.wife_id       || '',
    childrenIds:   f.children_ids  || [],
    marriageDate:  f.marriage_date || '',
    marriagePlace: f.marriage_place|| '',
    divorced:      f.divorced      || false,
  })); // end families map

  return { persons, families };
} // end of dbToGedcomData
