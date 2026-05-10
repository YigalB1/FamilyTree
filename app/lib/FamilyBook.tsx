// app/lib/FamilyBook.tsx
import React from 'react';
import { Document, Page, Text, View, Font, Image } from '@react-pdf/renderer';
import { GedcomData, Person, Family } from './parseGedcom';
import { Lang } from './TreePdf';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal', fontStyle: 'italic' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold',  fontStyle: 'italic' },
  ],
});

const FONT  = 'NotoHebrew';
const BLUE  = '#1e3a5f';
const LBLUE = '#dbeafe';
const LPINK = '#fce7f3';
const GRAY  = '#64748b';
const LGRAY = '#f8fafc';
const LINE  = '#e2e8f0';
const WHITE = '#ffffff';
const ACCENT_M = '#2563eb';
const ACCENT_F = '#db2877';

export type BookMode        = 'A' | 'B' | 'C';
export type BookOrientation = 'portrait' | 'landscape';

const A4P: [number, number] = [595.28, 841.89];
const A4L: [number, number] = [841.89, 595.28];

const MARGIN = 24;

interface BookOptions {
  rootPersonId: string;
  mode:         BookMode;
  orientation:  BookOrientation;
  lang:         Lang;
  data:         GedcomData;
  photoUrls:    Record<string, string>;
} // end BookOptions

// ── Helpers ───────────────────────────────────────────────────────

function dname(p: Person, lang: Lang): string {
  if (lang === 'he') return `${p.firstNameHe || ''} ${p.lastNameHe || ''}`.trim() || `${p.firstNameEn || ''} ${p.lastNameEn || ''}`.trim() || '—';
  if (lang === 'en') return `${p.firstNameEn || ''} ${p.lastNameEn || ''}`.trim() || `${p.firstNameHe || ''} ${p.lastNameHe || ''}`.trim() || '—';
  const he = `${p.firstNameHe || ''} ${p.lastNameHe || ''}`.trim();
  const en = `${p.firstNameEn || ''} ${p.lastNameEn || ''}`.trim();
  return he && en ? `${he} / ${en}` : he || en || '—';
} // end dname

function birthSurname(p: Person, lang: Lang): string {
  const bhe = (p as any).birthLastNameHe || '';
  const ben = (p as any).birthLastNameEn || '';
  const b   = lang === 'he' ? bhe : ben;
  const cur = lang === 'he' ? (p.lastNameHe || '') : (p.lastNameEn || '');
  return b && b !== cur ? b : '';
} // end birthSurname

function isDeceased(p: Person): boolean {
  return !!(p as any).isDeceased || !!p.deathDate;
} // end isDeceased

function accentColor(p: Person): string {
  return p.sex === 'M' ? ACCENT_M : p.sex === 'F' ? ACCENT_F : '#94a3b8';
} // end accentColor

function bgColor(p: Person): string {
  return p.sex === 'M' ? LBLUE : p.sex === 'F' ? LPINK : '#f1f5f9';
} // end bgColor

function getFamiliesAsParent(p: Person, families: Family[]): Family[] {
  return families.filter(f => f.husbandId === p.id || f.wifeId === p.id);
} // end getFamiliesAsParent

function getSpouseAndFamily(p: Person, families: Family[], pMap: Map<string, Person>): { spouse: Person | null; fam: Family | null } {
  const fam = getFamiliesAsParent(p, families)[0] || null;
  if (!fam) return { spouse: null, fam: null };
  const sid = fam.husbandId === p.id ? fam.wifeId : fam.husbandId;
  return { spouse: sid ? (pMap.get(sid) || null) : null, fam };
} // end getSpouseAndFamily

function getChildren(p: Person, families: Family[], pMap: Map<string, Person>): Person[] {
  return getFamiliesAsParent(p, families)
    .flatMap(f => f.childrenIds || [])
    .map(id => id ? pMap.get(id) : undefined)
    .filter((p): p is Person => p !== undefined && p !== null && !!p.id);
} // end getChildren

// ── Person Card ───────────────────────────────────────────────────

function PersonCard({ p, lang, photoUrl, cardW, compact }: {
  p: Person; lang: Lang; photoUrl?: string; cardW: number; compact?: boolean;
}) {
  const name   = dname(p, lang);
  const bsur   = birthSurname(p, lang);
  const dead   = isDeceased(p);
  const accent = accentColor(p);
  const bg     = bgColor(p);
  const PH     = compact ? 48 : 60; // photo height

  return (
    <View style={{
      width: cardW,
      backgroundColor: bg,
      borderRadius: 6,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      borderLeftStyle: 'solid',
      flexDirection: 'row',
      overflow: 'hidden',
      marginBottom: 4,
    }}>
      {/* Photo */}
      {photoUrl ? (
        <Image src={photoUrl} style={{ width: PH, height: PH, objectFit: 'cover' }} />
      ) : (
        <View style={{ width: PH, height: PH, backgroundColor: LINE,
          justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: GRAY }}>
            {p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '?'}
          </Text>
        </View>
      )}
      {/* Data */}
      <View style={{ flex: 1, padding: 6, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {dead && <Text style={{ fontSize: 8, color: GRAY, fontFamily: FONT }}>✝</Text>}
          <Text style={{ fontSize: compact ? 9 : 10, fontWeight: 'bold',
            color: BLUE, fontFamily: FONT }}>
            {name}
          </Text>
        </View>
        {bsur ? (
          <Text style={{ fontSize: 7, color: GRAY, fontFamily: FONT }}>
            {lang === 'he' ? `נ. ${bsur}` : `b. ${bsur}`}
          </Text>
        ) : null}
        {p.birthDate ? (
          <Text style={{ fontSize: 8, color: GRAY, fontFamily: FONT }}>
            {`b. ${p.birthDate}${p.birthPlace ? `  ${p.birthPlace}` : ''}`}
          </Text>
        ) : null}
        {p.deathDate ? (
          <Text style={{ fontSize: 8, color: GRAY, fontFamily: FONT }}>
            {`d. ${p.deathDate}${p.deathPlace ? `  ${p.deathPlace}` : ''}`}
          </Text>
        ) : dead && !p.deathDate ? (
          <Text style={{ fontSize: 8, color: GRAY, fontFamily: FONT }}>
            {lang === 'he' ? 'נפטר/ה' : 'Deceased'}
          </Text>
        ) : null}
      </View>
    </View>
  );
} // end PersonCard

// ── Couple Row ────────────────────────────────────────────────────

function CoupleRow({ p1, p2, fam, lang, photoUrls, availW, compact }: {
  p1: Person; p2: Person | null; fam: Family | null;
  lang: Lang; photoUrls: Record<string, string>;
  availW: number; compact?: boolean;
}) {
  const cardW = p2 ? (availW - 10) / 2 : availW;
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 2 }}>
        <PersonCard p={p1} lang={lang} photoUrl={photoUrls[p1.id]} cardW={cardW} compact={compact} />
        {p2 && (
          <PersonCard p={p2} lang={lang} photoUrl={photoUrls[p2.id]} cardW={cardW} compact={compact} />
        )}
      </View>
      {fam && fam.marriageDate && (
        <Text style={{ fontSize: 7, color: GRAY, fontFamily: FONT, marginBottom: 4, marginLeft: 4 }}>
          {`⚭ ${fam.marriageDate}${fam.marriagePlace ? `  ·  ${fam.marriagePlace}` : ''}${fam.divorced ? (lang === 'he' ? '  (גרוש/ה)' : '  (div.)') : ''}`}
        </Text>
      )}
    </View>
  );
} // end CoupleRow

// ── Children Row (side by side) ───────────────────────────────────

function ChildrenRow({ children, lang, photoUrls, availW, compact }: {
  children: Person[]; lang: Lang; photoUrls: Record<string, string>;
  availW: number; compact?: boolean;
}) {
  const validChildren = children.filter(c => c && c.id);
  if (validChildren.length === 0) return null;
  // Show up to 2 per row
  const perRow = validChildren.length <= 2 ? validChildren.length : 2;
  const cardW  = (availW - (perRow - 1) * 8) / perRow;
  const rows   = [];
  for (let i = 0; i < validChildren.length; i += perRow) {
    const batch = validChildren.slice(i, i + perRow);
    rows.push(
      <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
        {batch.map(c => (
          <PersonCard key={c.id} p={c} lang={lang} photoUrl={photoUrls[c.id]}
            cardW={cardW} compact={compact} />
        ))}
      </View>
    );
  }
  return <View>{rows}</View>;
} // end ChildrenRow

// ── Family Unit ───────────────────────────────────────────────────

interface FamilyUnit {
  person:   Person;
  spouse:   Person | null;
  fam:      Family | null;
  children: Person[];
  gen:      number;
} // end FamilyUnit

function buildUnits(rootId: string, data: GedcomData): FamilyUnit[] {
  const pMap  = new Map(data.persons.map(p => [p.id, p]));
  const units: FamilyUnit[] = [];
  const done  = new Set<string>();

  function visit(id: string, gen: number) {
    if (done.has(id)) return;
    done.add(id);
    const p = pMap.get(id);
    if (!p || !p.id) return;
    const { spouse, fam } = getSpouseAndFamily(p, data.families, pMap);
    if (spouse && spouse.id) done.add(spouse.id);
    const children = getChildren(p, data.families, pMap).filter(c => c && c.id);
    units.push({ person: p, spouse, fam, children, gen });
    for (const c of children) {
      if (c && c.id) visit(c.id, gen + 1);
    }
  } // end visit

  visit(rootId, 1);
  return units;
} // end buildUnits

// ── Page with generation header ───────────────────────────────────

function GenHeader({ gen, lang }: { gen: number; lang: Lang }) {
  const label = lang === 'he' ? `דור ${gen}` : `Generation ${gen}`;
  return (
    <View style={{
      backgroundColor: BLUE, borderRadius: 4,
      paddingHorizontal: 10, paddingVertical: 4,
      marginBottom: 10,
    }}>
      <Text style={{ fontSize: 10, fontWeight: 'bold', color: WHITE, fontFamily: FONT }}>
        {label}
      </Text>
    </View>
  );
} // end GenHeader

// ── Cover Page ────────────────────────────────────────────────────

function CoverPage({ roots, lang, pageSize, today, photoUrls }: {
  roots: { p: Person; spouse: Person | null }[];
  lang: Lang; pageSize: [number, number]; today: string;
  photoUrls: Record<string, string>;
}) {
  const andWord = lang === 'he' ? ' ו' : ' & ';
  const names = roots.map(r =>
    r.spouse ? `${dname(r.p, lang)}${andWord}${dname(r.spouse, lang)}` : dname(r.p, lang)
  ).join(', ');

  // Collect all people on cover (root + spouse)
  const coverPeople: Person[] = [];
  for (const r of roots) {
    coverPeople.push(r.p);
    if (r.spouse) coverPeople.push(r.spouse);
  }
  const PHOTO_SIZE = 80;

  return (
    <Page size={pageSize} style={{ fontFamily: FONT, backgroundColor: BLUE }} wrap={false}>
      {/* Date — top left */}
      <View style={{ position: 'absolute', top: 20, left: 24 }}>
        <Text style={{ fontSize: 8, color: '#93c5fd', fontFamily: FONT }}>{today}</Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <View style={{ width: '100%', height: 3, backgroundColor: '#93c5fd', marginBottom: 32 }} />

        {/* Title */}
        <Text style={{ fontSize: 16, color: '#bfdbfe', fontFamily: FONT,
          textAlign: 'center', marginBottom: 8 }}>
          {lang === 'he' ? 'ספר המשפחה של' : 'Family Book of'}
        </Text>

        {/* Names */}
        <Text style={{ fontSize: 26, fontWeight: 'bold', color: WHITE, fontFamily: FONT,
          textAlign: 'center', marginBottom: 28 }}>
          {names}
        </Text>

        {/* Photos below names — side by side */}
        {coverPeople.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 20, justifyContent: 'center', marginBottom: 32 }}>
            {coverPeople.map(p => {
              const url = photoUrls[p.id];
              return (
                <View key={p.id} style={{ alignItems: 'center', gap: 6 }}>
                  {url ? (
                    <Image
                      src={url.startsWith('http') ? url : `http://localhost:3000${url}`}
                      style={{ width: PHOTO_SIZE, height: PHOTO_SIZE,
                        borderRadius: 4, objectFit: 'cover',
                        borderWidth: 2, borderColor: '#93c5fd', borderStyle: 'solid' }}
                    />
                  ) : (
                    <View style={{ width: PHOTO_SIZE, height: PHOTO_SIZE,
                      backgroundColor: '#1e40af', borderRadius: 4,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 2, borderColor: '#93c5fd', borderStyle: 'solid' }}>
                      <Text style={{ fontSize: 32, color: WHITE }}>
                        {p.sex === 'M' ? '♂' : '♀'}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 9, color: '#bfdbfe', fontFamily: FONT, textAlign: 'center' }}>
                    {dname(p, lang)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ width: '100%', height: 3, backgroundColor: '#93c5fd' }} />
      </View>
    </Page>
  );
} // end CoverPage

// ── Main export ───────────────────────────────────────────────────

export function FamilyBook({ rootPersonId, mode, orientation, lang, data, photoUrls = {} }: BookOptions) {
  const pageSize: [number, number] = orientation === 'portrait' ? A4P : A4L;
  const [PW, PH]  = pageSize;
  const availW    = PW - MARGIN * 2;
  const pMap      = new Map(data.persons.map(p => [p.id, p]));
  const rootPerson = pMap.get(rootPersonId);
  if (!rootPerson) return <Document />;

  const today  = new Date().toLocaleDateString();
  const units  = buildUnits(rootPersonId, data);
  const { spouse: rootSpouse } = getSpouseAndFamily(rootPerson, data.families, pMap);

  // Group units by generation
  const genMap = new Map<number, FamilyUnit[]>();
  for (const u of units) {
    if (!genMap.has(u.gen)) genMap.set(u.gen, []);
    genMap.get(u.gen)!.push(u);
  }
  const gens = Array.from(genMap.keys()).sort((a, b) => a - b);

  // ── Build pages ──────────────────────────────────────────────
  // Mode B: pack multiple family units per page where possible
  // Each unit = parents row + children row
  // We use wrap={true} and let react-pdf flow content

  const pageStyle = {
    fontFamily: FONT,
    backgroundColor: WHITE,
    paddingHorizontal: MARGIN,
    paddingVertical: MARGIN,
  };

  const familyPages: React.ReactElement[] = [];
  let   pageContent: React.ReactElement[] = [];
  let   currentGen = -1;
  let   pageIdx    = 0;

  function flushPage() {
    if (pageContent.length === 0) return;
    familyPages.push(
      <Page key={`page-${pageIdx}`} size={pageSize} style={pageStyle} wrap={false}>
        <View>{pageContent}</View>
        {/* Footer */}
        <View style={{ position: 'absolute', bottom: 12, left: MARGIN, right: MARGIN,
          flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 7, color: LINE, fontFamily: FONT }}>
            {dname(rootPerson, lang)}
          </Text>
          <Text style={{ fontSize: 7, color: GRAY, fontFamily: FONT }}>
            {String(pageIdx + 2)}
          </Text>
        </View>
      </Page>
    );
    pageContent = [];
    pageIdx++;
  } // end flushPage

  // Estimate height of a family unit
  function unitHeight(u: FamilyUnit, compact: boolean): number {
    const cardH  = compact ? 52 : 64;
    const coupleH = cardH + 12; // couple row + marriage date
    const childH  = Math.ceil(u.children.length / 2) * (cardH + 4);
    const headerH = 24;
    return coupleH + childH + headerH + 16;
  } // end unitHeight

  let usedH = 0;
  const maxH = PH - MARGIN * 2 - 30; // available height per page

  for (const gen of gens) {
    const genUnits = genMap.get(gen)!;

    for (const u of genUnits) {
      const compact = mode === 'C';
      const uH = unitHeight(u, compact);

      // Add gen header if generation changed
      if (gen !== currentGen) {
        // Check if gen header fits
        if (usedH + 30 > maxH && pageContent.length > 0) {
          flushPage();
          usedH = 0;
        }
        pageContent.push(<GenHeader key={`gen-${gen}-${u.person.id}`} gen={gen} lang={lang} />);
        usedH += 30;
        currentGen = gen;
      }

      // Check if unit fits on current page
      if (usedH + uH > maxH && pageContent.length > 0) {
        flushPage();
        usedH = 0;
        // Re-add gen header on new page
        pageContent.push(<GenHeader key={`gen-${gen}-new-${u.person.id}`} gen={gen} lang={lang} />);
        usedH += 30;
      }

      // Add separator between units on same page
      if (pageContent.length > 0) {
        pageContent.push(
          <View key={`sep-${u.person.id}`} style={{
            height: 1, backgroundColor: LINE, marginVertical: 8,
          }} />
        );
        usedH += 17;
      }

      // Couple row
      pageContent.push(
        <CoupleRow key={`couple-${u.person.id}`}
          p1={u.person} p2={u.spouse} fam={u.fam}
          lang={lang} photoUrls={photoUrls}
          availW={availW} compact={compact}
        />
      );

      // Children row
      if (u.children.length > 0) {
        pageContent.push(
          <View key={`ch-label-${u.person.id}`} style={{ marginTop: 4, marginBottom: 4 }}>
            <Text style={{ fontSize: 8, color: GRAY, fontFamily: FONT, fontWeight: 'bold' }}>
              {lang === 'he' ? 'ילדים:' : 'Children:'}
            </Text>
          </View>
        );
        pageContent.push(
          <ChildrenRow key={`children-${u.person.id}`}
            children={u.children} lang={lang} photoUrls={photoUrls}
            availW={availW} compact={compact}
          />
        );
      }

      usedH += uH;
    }
  }

  flushPage(); // flush last page

  return (
    <Document>
      <CoverPage
        roots={[{ p: rootPerson, spouse: rootSpouse }]}
        lang={lang} pageSize={pageSize} today={today}
        photoUrls={photoUrls}
      />
      {familyPages}
    </Document>
  );
} // end FamilyBook
