import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Line } from '@react-pdf/renderer';
import { TreeNode } from './buildTree';
import { Person }   from './parseGedcom';
import { TreeSettings, defaultSettings } from './treeSettings';
import { Lang } from './TreePdf';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const FONT       = 'NotoHebrew';
const BLUE       = '#1e3a5f';
const MARGIN     = 30;
const HEADER     = 38;
const SPOUSE_GAP = 36;
const MISSING_W  = 20;

export type TileFormat = 'A4' | 'A3';

// Landscape dimensions [width, height]
const TILE_DIMS: Record<TileFormat, [number, number]> = {
  A4: [841.89,  595.28],
  A3: [1190.55, 841.89],
};

// ── Name helper — identical to TreePdf ───────────────────────────

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

// ── Layout helpers — exact copy from TreePdf ─────────────────────

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

// ── Layout engine — exact copy from TreePdf ──────────────────────

interface LayoutNode { node: TreeNode; x: number; y: number; width: number; children: LayoutNode[]; }
interface Connection { parentX: number; parentBottomY: number; childX: number; childTopY: number; }

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
    result.push({ parentX: personCardCenterX, parentBottomY, childX: childPersonCardCenterX, childTopY: child.y });
    collectConns(child, s, result);
  }
  return result;
} // end of collectConns

// ── Styles — exact copy from TreePdf ─────────────────────────────

const styles = StyleSheet.create({
  page:     { fontFamily: FONT, backgroundColor: '#f8fafc' },
  title:    { fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT, textAlign: 'center', marginBottom: 2 },
  sub:      { fontSize: 8,  color: '#64748b', textAlign: 'center', fontFamily: FONT },
  symbol:   { position: 'absolute', fontSize: 10, fontFamily: FONT },
  mdate:    { position: 'absolute', fontSize: 7,  color: '#1a1a1a', fontFamily: FONT, textAlign: 'center' },
  divLabel: { position: 'absolute', fontSize: 6,  color: '#94a3b8', fontFamily: FONT, textAlign: 'center' },
  unknown:  { position: 'absolute', fontSize: 8,  color: '#94a3b8', fontFamily: FONT },
});

// ── PersonCard — exact copy from TreePdf ─────────────────────────

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
          {`b. ${person.birthDate}`}
        </Text>
      )}
      {s.showBirthPlace && !!person.birthPlace && (
        <Text style={{ fontSize: s.detailFontSize, color: '#64748b', fontFamily: FONT, textAlign: 'center' }}>
          {person.birthPlace}
        </Text>
      )}
      {s.showDeathDate && !!person.deathDate && (
        <Text style={{ fontSize: s.detailFontSize, color: '#64748b', fontFamily: FONT, textAlign: 'center' }}>
          {`d. ${person.deathDate}`}
        </Text>
      )}
    </View>
  );
} // end of PersonCard

// ── SpouseConnector — exact copy from TreePdf ────────────────────

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
      <Text style={[styles.symbol, { left: lineLeft + SPOUSE_GAP / 2 - 5,
        top: top + lineMidY - 18, color: symbolColor }]}>{'\u26AD'}</Text>
      {fam.divorced && (
        <Text style={[styles.divLabel, { left: lineLeft, top: top + lineMidY + 12, width: SPOUSE_GAP }]}>
          {'div.'}
        </Text>
      )}
      {s.showMarriageDate && !!dayMonth && (
        <Text style={[styles.mdate, { left: lineLeft, top: top + lineMidY - 9, width: SPOUSE_GAP }]}>
          {dayMonth}
        </Text>
      )}
      {s.showMarriageDate && !!year && (
        <Text style={[styles.mdate, { left: lineLeft, top: top + lineMidY + 3, width: SPOUSE_GAP }]}>
          {year}
        </Text>
      )}
    </>
  );
} // end of SpouseConnector

// ── renderCanvas — renders the full tree on a canvas View ─────────
// This is the same as TreePdf's canvas section, extracted as a function
// so we can reuse it for each tile with a different offset.

function renderCanvas(
  flat: LayoutNode[], conns: Connection[], shift: number,
  canvasW: number, canvasH: number,
  s: TreeSettings, lang: Lang,
  offsetX: number, offsetY: number  // canvas offset for this tile
): React.ReactElement {
  return (
    <View style={{
      position: 'relative',
      width:  canvasW,
      height: canvasH,
      marginHorizontal: MARGIN,
      // Clip content outside this view by giving it exact dimensions
      overflow: 'hidden',
    }}>

      {/* Connections */}
      <Svg width={canvasW} height={canvasH}
        style={{ position: 'absolute', top: 0, left: 0 }}>
        {conns.map((c, i) => {
          const px   = c.parentX + shift - offsetX;
          const cx   = c.childX  + shift - offsetX;
          const py   = c.parentBottomY    - offsetY;
          const cy   = c.childTopY        - offsetY;
          const midY = (py + cy) / 2;
          return (
            <React.Fragment key={i}>
              <Line x1={px} y1={py} x2={px} y2={midY} stroke={s.lineColor} strokeWidth={1} />
              <Line x1={px} y1={midY} x2={cx} y2={midY} stroke={s.lineColor} strokeWidth={1} />
              <Line x1={cx} y1={midY} x2={cx} y2={cy}   stroke={s.lineColor} strokeWidth={1} />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Cards */}
      {flat.map((item, i) => {
        const cx         = item.x + shift - offsetX;
        const top        = item.y         - offsetY;
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
                    <SpouseConnector lineLeft={lineLeft} top={top} lineMidY={lineMidY}
                      fam={fam} s={s} dayMonth={dayMonth} year={year} />
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
                  <Text style={[styles.unknown, { left: wifeLeft, top: top + lineMidY - 6 }]}>
                    {'?'}
                  </Text>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })} {/* end flat.map */}

    </View>
  );
} // end of renderCanvas

// ── Main export ───────────────────────────────────────────────────

export function TiledTreePdf({ root, lang = 'he', settings = defaultSettings,
  tileFormat = 'A4' }: {
  root: TreeNode; lang?: Lang; settings?: TreeSettings; tileFormat?: TileFormat;
}) {
  const s = settings;
  const [tileW, tileH] = TILE_DIMS[tileFormat];

  // Layout — same as TreePdf
  const usableW = tileW - MARGIN * 2;
  const layout  = buildLayout(root, usableW / 2, 0, s);
  const flat    = flattenLayout(layout);
  const conns   = collectConns(layout, s);

  const minX  = Math.min(...flat.map(n => n.x - coupleW(n.node, s) / 2));
  const shift = minX < 0 ? -minX + s.hGap : 0;
  const maxX  = Math.max(...flat.map(n => n.x + coupleW(n.node, s) / 2)) + shift;
  const maxY  = Math.max(...flat.map(n => n.y + s.cardHeight));

  const canvasW = Math.max(usableW, maxX + s.hGap);
  const canvasH = maxY + s.vGap;

  // Tile grid
  const tileCanvasW = tileW - MARGIN * 2;
  const tileCanvasH = tileH - MARGIN * 2 - HEADER;
  const cols = Math.max(1, Math.ceil(canvasW / tileCanvasW));
  const rows = Math.max(1, Math.ceil(canvasH / tileCanvasH));

  const rootName = getDisplayName(root.person, lang);
  const today    = new Date().toLocaleDateString();

  // ── Cover page ────────────────────────────────────────────────
  const cover = (
    <Page key="cover" size={[tileW, tileH]} style={styles.page} wrap={false}>
      <View style={{ padding: 40 }}>
        <Text style={[styles.title, { fontSize: 18, marginBottom: 8 }]}>
          {`Family Tree \u2014 ${rootName}`}
        </Text>
        <Text style={[styles.sub, { marginBottom: 20 }]}>
          {`Tiled Print \u00b7 ${rows} rows \u00d7 ${cols} columns = ${rows * cols} ${tileFormat} pages \u00b7 ${today}`}
        </Text>
        <View style={{ backgroundColor: '#eff6ff', borderRadius: 8, padding: 14, marginBottom: 20 }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: BLUE,
            fontFamily: FONT, marginBottom: 8 }}>{'Assembly Instructions'}</Text>
          {[
            '1. Print all pages on ' + tileFormat + ' paper in landscape orientation',
            '2. Each page footer shows its position e.g. Row 1 / Col 2',
            '3. Assemble pages in order using the grid below',
            '4. Tape pages together along the edges',
          ].map((t, i) => (
            <Text key={i} style={{ fontSize: 9, color: '#1e40af',
              fontFamily: FONT, marginBottom: 3 }}>{t}</Text>
          ))}
        </View>
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: BLUE,
          fontFamily: FONT, marginBottom: 10 }}>
          {`Page Layout (${rows} rows \u00d7 ${cols} columns)`}
        </Text>
        <View style={{ flexDirection: 'column', gap: 3 }}>
          {Array.from({ length: rows }, (_, r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 3 }}>
              {Array.from({ length: cols }, (_, c) => (
                <View key={c} style={{
                  width: 56, height: 34, backgroundColor: '#dbeafe',
                  borderRadius: 4, borderWidth: 1, borderColor: '#93c5fd',
                  borderStyle: 'solid', justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ fontSize: 8, color: BLUE, fontFamily: FONT, fontWeight: 'bold' }}>
                    {`R${r+1}C${c+1}`}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          {[
            ['Total pages', `${rows * cols}`],
            ['Tile size',   `${tileFormat} Landscape`],
            ['People',      `${flat.length}`],
          ].map(([label, value]) => (
            <View key={label} style={{
              backgroundColor: 'white', borderRadius: 6, padding: 8,
              borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid',
            }}>
              <Text style={{ fontSize: 7, color: '#64748b', fontFamily: FONT, marginBottom: 2 }}>
                {label}
              </Text>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: BLUE, fontFamily: FONT }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  ); // end cover

  // ── Tile pages ────────────────────────────────────────────────
  const tilePages = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const offsetX = col * tileCanvasW;
      const offsetY = row * tileCanvasH;

      return (
        <Page key={`${row}-${col}`} size={[tileW, tileH]} style={styles.page} wrap={false}>

          {/* Header */}
          <View style={{ paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 }}>
            <Text style={styles.title}>
              {`Family Tree \u2014 ${rootName}`}
            </Text>
            <Text style={styles.sub}>
              {`Row ${row+1} / Col ${col+1}  (${rows}\u00d7${cols} pages) \u00b7 ${today}`}
            </Text>
          </View>

          {/* Canvas — renders the full tree with offset */}
          {renderCanvas(flat, conns, shift, tileCanvasW, tileCanvasH, s, lang, offsetX, offsetY)}

        </Page>
      );
    })
  ).flat();

  return (
    <Document>
      {cover}
      {tilePages}
    </Document>
  );
} // end of TiledTreePdf
