import { Person, Family, GedcomData } from './parseGedcom';

export interface TreeNode {
  person: Person;
  families: {
    spouse:        Person | null;
    children:      TreeNode[];
    marriageDate:  string;
    marriagePlace: string;
    divorced:      boolean;
  }[];
}

export function buildDescendantTree(
  rootId: string,
  data:   GedcomData,
  visited = new Set<string>()
): TreeNode | null {
  if (visited.has(rootId)) return null;
  visited.add(rootId);

  const person = data.persons.find(p => p.id === rootId);
  if (!person) return null;

  const ownFamilies = data.families.filter(
    f => f.husbandId === rootId || f.wifeId === rootId
  );

  const families = ownFamilies.map(fam => {
    const spouseId = fam.husbandId === rootId ? fam.wifeId : fam.husbandId;
    const spouse   = data.persons.find(p => p.id === spouseId) || null;

    const children = fam.childrenIds
      .map(cid => buildDescendantTree(cid, data, visited))
      .filter(Boolean) as TreeNode[];

    return {
      spouse,
      children,
      marriageDate:  fam.marriageDate,
      marriagePlace: fam.marriagePlace,
      divorced:      fam.divorced,
    };
  });

  return { person, families };
}