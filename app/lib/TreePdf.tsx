import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Line } from '@react-pdf/renderer';
import { TreeNode } from './buildTree';
import { Person }   from './parseGedcom';
import { TreeSettings, defaultSettings } from './treeSettings';
import { RosterPages, RosterEntry } from './RosterPages';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const FONT        = 'NotoHebrew';
const BLUE        = '#1e3a5f';
const MARGIN      = 30;
const HEADER      = 38;
const SPOUSE_GAP  = 36;
const MISSING_W   = 20;

export type PageFormat = 'A4L' | 'A3L' | 'A1L' | 'A0L';
export type Lang = 'all' | 'he' | 'en';

const PAGE_SIZES: Record<PageFormat, [number, number]> = {
  A4L: [841.89,  595.28],
  A3L: [1190.55, 841.89],
  A1L: [2383.94, 1683.78],
  A0L: [3370.39, 2383.94],
};

// ── Name helper ───────────────────────────────────────────────────

function getDisplayName(person: Person, lang: Lang): string {
  if (lang === 'he') {
    const n = `${person.firstNameHe || ''} ${person.lastNameHe || ''}`.trim();
    if (n) return n;
  }
  if (lang === 'en') {
    const n = `${person.firstNameEn || ''} ${person.lastNameEn || ''}`.trim();
    if (n) return n;
  }
  return `${person.firstName} ${person.lastName}`.trim();
} // end of getDisplayName

// ── Layout helpers ────────────────────────────────────────────────

function spousesWidth(node: TreeNode, s: TreeSettings): number {
  return node.families.reduce((sum, f) =>
    sum + SPOUSE_GAP + (f.spouse ? s.cardWidth : MISSING_W), 0);
} // end of spousesWidth

function coupleW(node: TreeNode, s: TreeSettings): number {
  if (node.families.length === 0) return s.cardWidth;
  return s.cardWidth + spousesWidth(node, s);
} // end of coupleW

function prevSpousesWidth(node: TreeNode, famIdx: number, s: TreeSettings): number {
  return node.families.slice(0, famIdx).reduce((sum, f) =>
    sum + SPOUSE_GAP + (f.spouse ? s.cardWidth : MISSING_W), 0);
} // end of prevSpousesWidth

// ── Layout engine ─────────────────────────────────────────────────

interface LayoutNode {
  node: TreeNode; x: number; y: number; width: number; children: LayoutNode[];
}
interface Connection {
  parentX: number; parentBottomY: number; childX: number; childTopY: number;
}

function subtreeWidth(node: TreeNode, s: TreeSettings): number {
  const allChildren = node.families.flatMap(f => f.children);
  if (allChildren.length === 0) return coupleW(node, s) + s.hGap;
  const childrenW = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  return Math.max(childrenW, coupleW(node, s) + s.hGap);
} // end of subtreeWidth

function buildLayout(node: TreeNode, x: number, y: number, s: TreeSettings): LayoutNode {
  const allChildren = node.families.flatMap(f => f.children);
  const childY      = y + s.cardHeight + s.vGap;
  const totalW      = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  let cursor        = x - totalW / 2;
  const children: LayoutNode[] = [];
  for (const child of allChildren) {
    const w = subtreeWidth(child, s);
    children.push(buildLayout(child, cursor + w / 2, childY, s));
    cursor += w;
  }
  return { node, x, y, width: subtreeWidth(node, s), children };
} // end of buildLayout

function flattenLayout(l: LayoutNode, result: LayoutNode[] = []): LayoutNode[] {
  result.push(l);
  for (const c of l.children) flattenLayout(c, result);
  return result;
} // end of flattenLayout

function collectConns(layout: LayoutNode, s: TreeSettings, result: Connection[] = []): Connection[] {
  const parentBottomY     = layout.y + s.cardHeight;
  const personLeft        = layout.x - coupleW(layout.node, s) / 2;
  const personCardCenterX = personLeft + s.cardWidth / 2;
  for (const child of layout.children) {
    const childPersonLeft        = child.x - coupleW(child.node, s) / 2;
    const childPersonCardCenterX = childPersonLeft + s.cardWidth / 2;
    result.push({ parentX: personCardCenterX, parentBottomY,
                  childX: childPersonCardCenterX, childTopY: child.y });
    collectConns(child, s, result);
  }
  return result;
} // end of collectConns

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page:     { fontFamily: FONT, backgroundColor: '#f8fafc' },
  title:    { fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT,
              textAlign: 'center', marginBottom: 2 },
  sub:      { fontSize: 8, color: '#64748b', textAlign: 'center', fontFamily: FONT },
  symbol:   { position: 'absolute', fontSize: 10, fontFamily: FONT },
  mdate:    { position: 'absolute', fontSize: 7, color: '#1a1a1a', fontFamily: FONT, textAlign: 'center' },
  divLabel: { position: 'absolute', fontSize: 6, color: '#94a3b8', fontFamily: FONT, textAlign: 'center' },
  unknown:  { position: 'absolute', fontSize: 8, color: '#94a3b8', fontFamily: FONT },
});

// ── Person card ───────────────────────────────────────────────────

function PersonCard({ person, left, top, lang, s }: {
  person: Person; left: number; top: number; lang: Lang; s: TreeSettings;
}) {
  const name    = getDisplayName(person, lang);
  const bgColor = person.sex === 'M' ? s.maleColor   : person.sex === 'F' ? s.femaleColor : '#f1f5f9';
  const accent  = person.sex === 'M' ? '#2563eb'      : person.sex === 'F' ? '#db2777'    : '#94a3b8';
  return (
    <View style={{
      position: 'absolute', left, top,
      width: s.cardWidth, height: s.cardHeight,
      borderRadius: s.borderRadius, padding: 6,
      backgroundColor: bgColor,
      borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: 'solid',
      justifyContent: 'center',
      ...(s.showBorder ? { borderWidth: 1, borderColor: s.borderColor, borderStyle: 'solid' } : {}),
    }}>
      <Text style={{ fontSize: s.nameFontSize, fontWeight: 'bold', color: BLUE,
        fontFamily: FONT, textAlign: 'center', marginBottom: 2 }}>{name}</Text>
      {!!person.birthDate && (
        <Text style={{ fontSize: s.detailFontSize, color: '#64748b', fontFamily: FONT, textAlign: 'center' }}>
          b. {person.birthDate}
        </Text>
      )}
      {s.showBirthPlace && !!person.birthPlace && (
        <Text style={{ fontSize: s.detailFontSize, color: '#64748b', fontFamily: FONT, textAlign: 'center' }}>
          {person.birthPlace}
        </Text>
      )}
      {s.showDeathDate && !!person.deathDate && (
        <Text style={{ fontSize: s.detailFontSize, color: '#64748b', fontFamily: FONT, textAlign: 'center' }}>
          d. {person.deathDate}
        </Text>
      )}
    </View>
  );
} // end of PersonCard

// ── Spouse connector ──────────────────────────────────────────────

function SpouseConnector({ lineLeft, top, lineMidY, fam, s, dayMonth, year }: {
  lineLeft: number; top: number; lineMidY: number;
  fam: TreeNode['families'][0]; s: TreeSettings;
  dayMonth: string; year: string;
}) {
  const lineColor   = fam.divorced ? '#94a3b8' : '#1a1a1a';
  const symbolColor = fam.divorced ? '#94a3b8' : '#1a1a1a';
  return (
    <>
      <Svg width={SPOUSE_GAP} height={s.cardHeight}
        style={{ position: 'absolute', left: lineLeft, top }}>
        <Line x1={0} y1={lineMidY} x2={SPOUSE_GAP} y2={lineMidY}
          stroke={lineColor} strokeWidth={1.5}
          strokeDasharray={fam.divorced ? '3,3' : undefined} />
      </Svg>
      <Text style={[styles.symbol, {
        left: lineLeft + SPOUSE_GAP / 2 - 5, top: top + lineMidY - 18, color: symbolColor,
      }]}>{'\u26AD'}</Text>
      {fam.divorced && (
        <Text style={[styles.divLabel, {
          left: lineLeft, top: top + lineMidY + 12, width: SPOUSE_GAP,
        }]}>{'div.'}</Text>
      )}
      {s.showMarriageDate && !!dayMonth && (
        <Text style={[styles.mdate, {
          left: lineLeft, top: top + lineMidY - 9, width: SPOUSE_GAP,
        }]}>{dayMonth}</Text>
      )}
      {s.showMarriageDate && !!year && (
        <Text style={[styles.mdate, {
          left: lineLeft, top: top + lineMidY + 3, width: SPOUSE_GAP,
        }]}>{year}</Text>
      )}
    </>
  );
} // end of SpouseConnector

// ── Main PDF ──────────────────────────────────────────────────────

interface Props {
  root:             TreeNode;
  format?:          PageFormat;
  lang?:            Lang;
  settings?:        TreeSettings;
  // Optional roster appendix
  rosterEntries?:   RosterEntry[];
  rosterRootName?:  string;
  rosterToday?:     string;
} // end of Props

export function TreePdf({
  root, format = 'A4L', lang = 'he', settings = defaultSettings,
  rosterEntries, rosterRootName, rosterToday,
}: Props) {
  const s              = settings;
  const [pageW, pageH] = PAGE_SIZES[format];
  const usableW        = pageW - MARGIN * 2;

  const layout = buildLayout(root, usableW / 2, 0, s);
  const flat   = flattenLayout(layout);
  const conns  = collectConns(layout, s);

  const minX  = Math.min(...flat.map(n => n.x - coupleW(n.node, s) / 2));
  const shift = minX < 0 ? -minX + s.hGap : 0;

  const maxX  = Math.max(...flat.map(n => n.x + coupleW(n.node, s) / 2)) + shift;
  const maxY  = Math.max(...flat.map(n => n.y + s.cardHeight));

  const canvasW  = Math.max(usableW, maxX + s.hGap);
  const canvasH  = maxY + s.vGap;
  const rootName = getDisplayName(root.person, lang);
  const today    = rosterToday || new Date().toLocaleDateString();

  return (
    <Document>

      {/* ── Tree page ── */}
      <Page
        size={[
          Math.max(pageW, canvasW + MARGIN * 2),
          Math.max(pageH, canvasH + HEADER + MARGIN * 2),
        ]}
        style={styles.page}
        wrap={false}
      >
        <View style={{ paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 }}>
          <Text style={styles.title}>Family Tree — {rootName}</Text>
          <Text style={styles.sub}>
            Generated {today} · {format}
          </Text>
        </View>

        <View style={{ position: 'relative', marginHorizontal: MARGIN,
          width: canvasW, height: canvasH }}>

          <Svg width={canvasW} height={canvasH}
            style={{ position: 'absolute', top: 0, left: 0 }}>
            {conns.map((c, i) => {
              const px   = c.parentX + shift;
              const cx   = c.childX  + shift;
              const midY = (c.parentBottomY + c.childTopY) / 2;
              return (
                <React.Fragment key={i}>
                  <Line x1={px} y1={c.parentBottomY} x2={px} y2={midY}
                    stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={px} y1={midY} x2={cx} y2={midY}
                    stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={cx} y1={midY} x2={cx} y2={c.childTopY}
                    stroke={s.lineColor} strokeWidth={1} />
                </React.Fragment>
              );
            })}
          </Svg>

          {flat.map((item, i) => {
            const cx         = item.x + shift;
            const top        = item.y;
            const lineMidY   = s.cardHeight / 2;
            const personLeft = cx - coupleW(item.node, s) / 2;

            if (item.node.families.length === 0) {
              return (
                <PersonCard key={i} person={item.node.person}
                  left={cx - s.cardWidth / 2} top={top} lang={lang} s={s} />
              );
            } // end if no families

            return (
              <React.Fragment key={i}>
                <PersonCard person={item.node.person}
                  left={personLeft} top={top} lang={lang} s={s} />
                {item.node.families.map((fam, famIdx) => {
                  const prevW    = prevSpousesWidth(item.node, famIdx, s);
                  const lineLeft = personLeft + s.cardWidth + prevW;
                  const wifeLeft = lineLeft + SPOUSE_GAP;
                  const parts    = (fam.marriageDate || '').split(' ');
                  const hasDate  = parts.length === 3;
                  const dayMonth = hasDate ? `${parts[0]} ${parts[1]}` : '';
                  const year     = hasDate ? parts[2] : fam.marriageDate || '';

                  if (fam.spouse) {
                    return (
                      <React.Fragment key={famIdx}>
                        <SpouseConnector lineLeft={lineLeft} top={top}
                          lineMidY={lineMidY} fam={fam} s={s}
                          dayMonth={dayMonth} year={year} />
                        <PersonCard person={fam.spouse}
                          left={wifeLeft} top={top} lang={lang} s={s} />
                      </React.Fragment>
                    );
                  } // end if spouse

                  return (
                    <React.Fragment key={famIdx}>
                      <Svg width={SPOUSE_GAP} height={s.cardHeight}
                        style={{ position: 'absolute', left: lineLeft, top }}>
                        <Line x1={0} y1={lineMidY} x2={SPOUSE_GAP} y2={lineMidY}
                          stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="3,3" />
                      </Svg>
                      <Text style={[styles.unknown, {
                        left: wifeLeft, top: top + lineMidY - 6,
                      }]}>{'?'}</Text>
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}

        </View>
      </Page>

      {/* ── Roster appendix pages (optional) ── */}
      {rosterEntries && rosterEntries.length > 0 && (
        <RosterPages
          entries={rosterEntries}
          rootName={rosterRootName || rootName}
          today={today}
        />
      )}

    </Document>
  );
} // end of TreePdf
