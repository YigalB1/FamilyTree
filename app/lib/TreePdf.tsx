import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Line } from '@react-pdf/renderer';
import { TreeNode } from './buildTree';
import { Person } from './parseGedcom';
import { TreeSettings, defaultSettings } from './treeSettings';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const FONT      = 'NotoHebrew';
const BLUE      = '#1e3a5f';
const MARGIN    = 30;
const HEADER    = 38;
const SPOUSE_GAP = 36;
const FAM_STACK  = 8; // vertical gap between stacked marriages

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
}

// ── Layout engine ─────────────────────────────────────────────────

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
}

function blockH(node: TreeNode, s: TreeSettings): number {
  const n = Math.max(node.families.length, 1);
  return n * s.cardHeight + (n - 1) * FAM_STACK;
}

function coupleW(node: TreeNode, s: TreeSettings): number {
  const hasSpouse = node.families.some(f => f.spouse !== null);
  return hasSpouse ? s.cardWidth * 2 + SPOUSE_GAP : s.cardWidth;
}

function subtreeWidth(node: TreeNode, s: TreeSettings): number {
  const allChildren = node.families.flatMap(f => f.children);
  if (allChildren.length === 0) return coupleW(node, s) + s.hGap;
  const childrenW = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  return Math.max(childrenW, coupleW(node, s) + s.hGap);
}

function buildLayout(node: TreeNode, x: number, y: number, s: TreeSettings): LayoutNode {
  const allChildren = node.families.flatMap(f => f.children);
  const childY      = y + blockH(node, s) + s.vGap;
  const totalW      = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  let cursor        = x - totalW / 2;
  const children: LayoutNode[] = [];
  for (const child of allChildren) {
    const w = subtreeWidth(child, s);
    children.push(buildLayout(child, cursor + w / 2, childY, s));
    cursor += w;
  }
  return { node, x, y, width: subtreeWidth(node, s), children };
}

function flattenLayout(l: LayoutNode, result: LayoutNode[] = []): LayoutNode[] {
  result.push(l);
  for (const c of l.children) flattenLayout(c, result);
  return result;
}

// ── Connections ───────────────────────────────────────────────────

interface Connection {
  parentX: number; parentBottomY: number;
  childX:  number; childTopY:    number;
}

function collectConns(layout: LayoutNode, s: TreeSettings, result: Connection[] = []): Connection[] {
  const parentBottomY    = layout.y + blockH(layout.node, s);
  const cw               = s.cardWidth * 2 + SPOUSE_GAP;
  const hasSpouse        = !!layout.node.families[0]?.spouse;
  const parentCardCenterX = hasSpouse
    ? layout.x - cw / 2 + s.cardWidth / 2
    : layout.x;

  for (const child of layout.children) {
    const childHasSpouse   = !!child.node.families[0]?.spouse;
    const childCardCenterX = childHasSpouse
      ? child.x - cw / 2 + s.cardWidth / 2
      : child.x;

    result.push({
      parentX:      parentCardCenterX,
      parentBottomY,
      childX:       childCardCenterX,
      childTopY:    child.y,
    });
    collectConns(child, s, result);
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page:    { fontFamily: FONT, backgroundColor: '#f8fafc' },
  title:   { fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT, textAlign: 'center', marginBottom: 2 },
  sub:     { fontSize: 8, color: '#64748b', textAlign: 'center', fontFamily: FONT },
  symbol:  { position: 'absolute', fontSize: 10, fontFamily: FONT },
  mdate:   { position: 'absolute', fontSize: 7, color: '#1a1a1a', fontFamily: FONT, textAlign: 'center' },
});

// ── Person card ───────────────────────────────────────────────────

function PersonCard({ person, left, top, lang, s }: {
  person: Person; left: number; top: number; lang: Lang; s: TreeSettings;
}) {
  const name    = getDisplayName(person, lang);
  const bgColor = person.sex === 'M' ? s.maleColor : person.sex === 'F' ? s.femaleColor : '#f1f5f9';
  const accent  = person.sex === 'M' ? '#2563eb'   : person.sex === 'F' ? '#db2777'    : '#94a3b8';

  return (
    <View style={{
      position: 'absolute',
      left, top,
      width:           s.cardWidth,
      height:          s.cardHeight,
      borderRadius:    s.borderRadius,
      padding:         6,
      backgroundColor: bgColor,
      borderLeftWidth: 3,
      borderLeftColor: accent,
      borderLeftStyle: 'solid',
      justifyContent:  'center',
      ...(s.showBorder ? {
        borderWidth: 1, borderColor: s.borderColor, borderStyle: 'solid',
      } : {}),
    }}>
      <Text style={{ fontSize: s.nameFontSize, fontWeight: 'bold', color: BLUE, fontFamily: FONT, textAlign: 'center', marginBottom: 2 }}>
        {name}
      </Text>
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
}

// ── Main PDF ──────────────────────────────────────────────────────

interface Props {
  root:      TreeNode;
  format?:   PageFormat;
  lang?:     Lang;
  settings?: TreeSettings;
}

export function TreePdf({ root, format = 'A4L', lang = 'he', settings = defaultSettings }: Props) {
  const s              = settings;
  const [pageW, pageH] = PAGE_SIZES[format];
  const usableW        = pageW - MARGIN * 2;
  const cw             = s.cardWidth * 2 + SPOUSE_GAP;

  const layout  = buildLayout(root, usableW / 2, 0, s);
  const flat    = flattenLayout(layout);
  const conns   = collectConns(layout, s);

  const minX  = Math.min(...flat.map(n => n.x - cw / 2));
  const shift = minX < 0 ? -minX + s.hGap : 0;
  const maxX  = Math.max(...flat.map(n => n.x + cw / 2)) + shift;
  const maxY  = Math.max(...flat.map(n => n.y + blockH(n.node, s)));

  const canvasW = Math.max(usableW, maxX + s.hGap);
  const canvasH = maxY + s.vGap;
  const rootName = getDisplayName(root.person, lang);

  return (
    <Document>
      <Page
        size={[Math.max(pageW, canvasW + MARGIN * 2), Math.max(pageH, canvasH + HEADER + MARGIN * 2)]}
        style={styles.page}
        wrap={false}
      >
        {/* Header */}
        <View style={{ paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 }}>
          <Text style={styles.title}>Family Tree — {rootName}</Text>
          <Text style={styles.sub}>Generated {new Date().toLocaleDateString()} · {format}</Text>
        </View>

        {/* Canvas */}
        <View style={{ position: 'relative', marginHorizontal: MARGIN, width: canvasW, height: canvasH }}>

          {/* Connection lines */}
          <Svg width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0 }}>
            {conns.map((c, i) => {
              const px   = c.parentX + shift;
              const cx   = c.childX  + shift;
              const midY = (c.parentBottomY + c.childTopY) / 2;
              return (
                <React.Fragment key={i}>
                  <Line x1={px} y1={c.parentBottomY} x2={px} y2={midY}   stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={px} y1={midY}            x2={cx} y2={midY}   stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={cx} y1={midY}            x2={cx} y2={c.childTopY} stroke={s.lineColor} strokeWidth={1} />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Person blocks */}
          {flat.map((item, i) => {
            const cx  = item.x + shift;
            const top = item.y;

            if (item.node.families.length === 0) {
              return (
                <PersonCard key={i} person={item.node.person}
                  left={cx - s.cardWidth / 2} top={top} lang={lang} s={s} />
              );
            }

            return (
              <React.Fragment key={i}>
                {item.node.families.map((fam, famIdx) => {
                  const spouse  = fam.spouse;
                  const famTop  = top + famIdx * (s.cardHeight + FAM_STACK);
                  const lineMidY = s.cardHeight / 2;

                  const dateParts   = (fam.marriageDate || '').split(' ');
                  const hasFullDate = dateParts.length === 3;
                  const dayMonth    = hasFullDate ? `${dateParts[0]} ${dateParts[1]}` : '';
                  const year        = hasFullDate ? dateParts[2] : fam.marriageDate || '';

                  if (spouse) {
                    const husbLeft = cx - cw / 2;
                    const wifeLeft = cx + SPOUSE_GAP / 2;
                    const lineLeft = cx - SPOUSE_GAP / 2;

                    return (
                      <React.Fragment key={famIdx}>
                        {/* Person */}
                        <PersonCard person={item.node.person}
                          left={husbLeft} top={famTop} lang={lang} s={s} />

                        {/* Horizontal line between spouses */}
                        <Svg width={SPOUSE_GAP} height={s.cardHeight}
                          style={{ position: 'absolute', left: lineLeft, top: famTop }}>
                          <Line x1={0} y1={lineMidY} x2={SPOUSE_GAP} y2={lineMidY}
                            stroke="#1a1a1a" strokeWidth={1.5} />
                        </Svg>

                        {/* Marriage symbol */}
                        <Text style={[styles.symbol, {
                          left: cx - 6, top: famTop + lineMidY - 18, color: '#1a1a1a',
                        }]}>
                          {'\u26AD'}
                        </Text>

                        {/* Day/month above midline */}
                        {s.showMarriageDate && !!dayMonth && (
                          <Text style={[styles.mdate, {
                            left: lineLeft, top: famTop + lineMidY - 9, width: SPOUSE_GAP,
                          }]}>{dayMonth}</Text>
                        )}

                        {/* Year below midline */}
                        {s.showMarriageDate && !!year && (
                          <Text style={[styles.mdate, {
                            left: lineLeft, top: famTop + lineMidY + 3, width: SPOUSE_GAP,
                          }]}>{year}</Text>
                        )}

                        {/* Spouse */}
                        <PersonCard person={spouse}
                          left={wifeLeft} top={famTop} lang={lang} s={s} />
                      </React.Fragment>
                    );
                  } else {
                    return (
                      <PersonCard key={famIdx} person={item.node.person}
                        left={cx - s.cardWidth / 2} top={famTop} lang={lang} s={s} />
                    );
                  }
                })}
              </React.Fragment>
            );
          })}

        </View>
      </Page>
    </Document>
  );
}