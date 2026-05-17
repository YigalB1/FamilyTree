// app/lib/RosterPages.tsx
// Roster appendix pages for the family tree PDF.
// Rendered inside the same <Document> as TreePdf — no merging needed.

import React from 'react';
import { Page, Text, View, Font, StyleSheet } from '@react-pdf/renderer';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const F    = 'NotoHebrew';
const BLUE = '#1e3a5f';
const GRAY = '#64748b';
const LINE = '#e2e8f0';
const LGRAY= '#f8fafc';

// Page size — A4 landscape to match tiled pages
const PW = 841.89;
const PH = 595.28;
const M  = 20;  // margin

// Column widths (points) — total usable = PW - 2*M ≈ 801
const COL = {
  num:   22,
  heNm:  130,
  enNm:  130,
  dates:  72,
  father: 190,
  mother: 190,
  // remainder: 801 - 22 - 130 - 130 - 72 - 190 - 190 = 67 (padding buffer)
};

export interface RosterEntry {
  number:      number;
  firstNameHe: string;
  lastNameHe:  string;
  firstNameEn: string;
  lastNameEn:  string;
  birthDate:   string;
  deathDate:   string;
  fatherHe:    string;
  fatherEn:    string;
  motherHe:    string;
  motherEn:    string;
} // end of RosterEntry interface

const s = StyleSheet.create({
  page:     { fontFamily: F, backgroundColor: 'white' },
  hdrBand:  { backgroundColor: BLUE, flexDirection: 'row',
              paddingHorizontal: M, paddingVertical: 5 },
  hdrTitle: { color: 'white', fontSize: 13, fontFamily: F,
              fontWeight: 'bold', flex: 1 },
  hdrSub:   { color: '#93c5fd', fontSize: 8, fontFamily: F,
              marginTop: 2 },
  tableWrap:{ marginHorizontal: M, marginTop: 4, flex: 1 },
  // Table header row
  tHdrRow:  { flexDirection: 'row', backgroundColor: BLUE,
              paddingVertical: 3, paddingHorizontal: 2 },
  tHdrCell: { color: 'white', fontSize: 7, fontFamily: F,
              fontWeight: 'bold' },
  // Data rows
  rowEven:  { flexDirection: 'row', backgroundColor: LGRAY,
              paddingVertical: 2.5, paddingHorizontal: 2,
              borderBottomWidth: 0.3, borderBottomColor: LINE,
              borderBottomStyle: 'solid' },
  rowOdd:   { flexDirection: 'row', backgroundColor: 'white',
              paddingVertical: 2.5, paddingHorizontal: 2,
              borderBottomWidth: 0.3, borderBottomColor: LINE,
              borderBottomStyle: 'solid' },
  // Cell text styles
  cNum:     { fontSize: 8, fontFamily: F, fontWeight: 'bold',
              color: BLUE, textAlign: 'center' },
  cBold:    { fontSize: 8, fontFamily: F, fontWeight: 'bold',
              color: '#1a1a1a' },
  cSub:     { fontSize: 7, fontFamily: F, color: GRAY, marginTop: 1 },
  cDob:     { fontSize: 7.5, fontFamily: F, color: '#374151' },
  cDod:     { fontSize: 7, fontFamily: F, color: GRAY, marginTop: 1 },
  // Footer
  footer:   { flexDirection: 'row', justifyContent: 'space-between',
              paddingHorizontal: M, paddingVertical: 4,
              borderTopWidth: 0.3, borderTopColor: LINE,
              borderTopStyle: 'solid' },
  footText: { fontSize: 7, color: GRAY, fontFamily: F },
});

// Rows per page — A4 landscape at ~10pt row height fits about 48 rows
const ROWS_PER_PAGE = 46;

// ── Header row ────────────────────────────────────────────────────

function TableHeader() {
  const cols = [
    { w: COL.num,    label: 'מס׳' },
    { w: COL.heNm,   label: 'שם עברי' },
    { w: COL.enNm,   label: 'שם אנגלי' },
    { w: COL.dates,  label: 'לידה / פטירה' },
    { w: COL.father, label: 'אב' },
    { w: COL.mother, label: 'אם' },
  ];
  return (
    <View style={s.tHdrRow}>
      {cols.map(c => (
        <View key={c.label} style={{ width: c.w }}>
          <Text style={s.tHdrCell}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
} // end of TableHeader

// ── Single data row ───────────────────────────────────────────────

function DataRow({ entry, even }: { entry: RosterEntry; even: boolean }) {
  const heName = `${entry.firstNameHe} ${entry.lastNameHe}`.trim();
  const enName = `${entry.firstNameEn} ${entry.lastNameEn}`.trim();
  const faHe   = `${entry.fatherHe}`.trim();
  const faEn   = `${entry.fatherEn}`.trim();
  const moHe   = `${entry.motherHe}`.trim();
  const moEn   = `${entry.motherEn}`.trim();

  return (
    <View style={even ? s.rowEven : s.rowOdd} wrap={false}>

      {/* # */}
      <View style={{ width: COL.num, justifyContent: 'center' }}>
        <Text style={s.cNum}>{entry.number}</Text>
      </View>

      {/* Hebrew name */}
      <View style={{ width: COL.heNm }}>
        {heName ? <Text style={s.cBold}>{heName}</Text>
                : <Text style={s.cSub}>—</Text>}
      </View>

      {/* English name */}
      <View style={{ width: COL.enNm }}>
        {enName ? <Text style={s.cBold}>{enName}</Text>
                : <Text style={s.cSub}>—</Text>}
      </View>

      {/* Dates */}
      <View style={{ width: COL.dates }}>
        {entry.birthDate
          ? <Text style={s.cDob}>b. {entry.birthDate}</Text>
          : <Text style={s.cSub}>—</Text>}
        {!!entry.deathDate &&
          <Text style={s.cDod}>d. {entry.deathDate}</Text>}
      </View>

      {/* Father */}
      <View style={{ width: COL.father }}>
        {faHe ? <Text style={s.cBold}>{faHe}</Text> : null}
        {faEn ? <Text style={s.cSub}>{faEn}</Text>  : null}
        {!faHe && !faEn ? <Text style={s.cSub}>—</Text> : null}
      </View>

      {/* Mother */}
      <View style={{ width: COL.mother }}>
        {moHe ? <Text style={s.cBold}>{moHe}</Text> : null}
        {moEn ? <Text style={s.cSub}>{moEn}</Text>  : null}
        {!moHe && !moEn ? <Text style={s.cSub}>—</Text> : null}
      </View>

    </View>
  );
} // end of DataRow

// ── Main export ───────────────────────────────────────────────────

export function RosterPages({ entries, rootName, today }: {
  entries:  RosterEntry[];
  rootName: string;
  today:    string;
}) {
  // Split entries into pages
  const pages: RosterEntry[][] = [];
  for (let i = 0; i < entries.length; i += ROWS_PER_PAGE) {
    pages.push(entries.slice(i, i + ROWS_PER_PAGE));
  } // end for

  const totalPages = pages.length;

  return (
    <>
      {pages.map((pageEntries, pi) => (
        <Page key={pi} size={[PW, PH]}
          style={s.page} wrap={false}>

          {/* Header band */}
          <View style={s.hdrBand}>
            <View style={{ flex: 1 }}>
              <Text style={s.hdrTitle}>
                {`רשימת בני המשפחה \u2014 ${rootName}`}
              </Text>
              <Text style={s.hdrSub}>
                {`${entries.length} \u05d0\u05e0\u05e9\u05d9\u05dd \u00b7 \u05e0\u05e1\u05e4\u05d7 ${pi + 1} \u05de\u05ea\u05d5\u05da ${totalPages} \u00b7 ${today}`}
              </Text>
            </View>
          </View>

          {/* Table */}
          <View style={s.tableWrap}>
            <TableHeader />
            {pageEntries.map((entry, ri) => (
              <DataRow key={entry.number} entry={entry} even={ri % 2 === 0} />
            ))}
          </View>

          {/* Footer */}
          <View style={s.footer}>
            <Text style={s.footText}>{`Family Tree \u2014 ${rootName}`}</Text>
            <Text style={s.footText}>
              {`\u05e8\u05e9\u05d9\u05de\u05ea \u05d1\u05e0\u05d9 \u05de\u05e9\u05e4\u05d7\u05d4 \u2014 \u05e2\u05de\u05d5\u05d3 ${pi + 1} \u05de\u05ea\u05d5\u05da ${totalPages}`}
            </Text>
            <Text style={s.footText}>{today}</Text>
          </View>

        </Page>
      ))}
    </>
  );
} // end of RosterPages
