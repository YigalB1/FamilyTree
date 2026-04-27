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

const FONT = 'NotoHebrew';
const BLUE = '#1e3a5f';
const MARGIN = 30;
const HEADER = 38;

export type PageFormat = 'A4L' | 'A3L' | 'A1L' | 'A0L';
export type Lang = 'all' | 'he' | 'en';

const PAGE_SIZES: Record<PageFormat, [number, number]> = {
  A4L: [841.89, 595.28],
  A3L: [1190.55, 841.89],
  A1L: [2383.94, 1683.78],
  A0L: [3370.39, 2383.94],
};

const SPOUSE_GAP = 36;

// ── Layout engine ─────────────────────────────────────────────────

interface LayoutNode {
  node: TreeNode;
  x: number; y: number; width: number;
  children: LayoutNode[];
}

function coupleWidth(node: TreeNode, s: TreeSettings): number {
  const fam = node.families[0];
  return fam?.spouse ? s.cardWidth * 2 + SPOUSE_GAP : s.cardWidth;
}

function subtreeWidth(node: TreeNode, s: TreeSettings): number {
  const allChildren = node.families.flatMap(f => f.children);
  if (allChildren.length === 0) return coupleWidth(node, s) + s.hGap;
  const childrenW = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  return Math.max(childrenW, coupleWidth(node, s) + s.hGap);
}

function buildLayout(node: TreeNode, x: number, y: number, s: TreeSettings): LayoutNode {
  const allChildren = node.families.flatMap(f => f.children);
  const childY = y + s.cardHeight + s.vGap;
  const totalW = allChildren.reduce((sum, c) => sum + subtreeWidth(c, s), 0);
  let cursor = x - totalW / 2;
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

interface Connection { parentX: number; parentBottomY: number; childX: number; childTopY: number; }

function collectConnections(l: LayoutNode, result: Connection[] = []): Connection[] {
  for (const c of l.children) {
    result.push({ parentX: l.x, parentBottomY: l.y + l.node.families[0] ? 0 : 0, childX: c.x, childTopY: c.y });
    collectConnections(c, result);
  }
  return result;
}

function collectConns(layout: LayoutNode, s: TreeSettings, result: Connection[] = []): Connection[] {
  const parentBottomY = layout.y + s.cardHeight;
  for (const child of layout.children) {
    result.push({ parentX: layout.x, parentBottomY, childX: child.x, childTopY: child.y });
    collectConns(child, s, result);
  }
  return result;
}

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

// ── Person card ───────────────────────────────────────────────────

function PersonCard({ person, left, top, lang, s }: {
  person: Person; left: number; top: number; lang: Lang; s: TreeSettings;
}) {
  const name     = getDisplayName(person, lang);
  const bgColor  = person.sex === 'M' ? s.maleColor : person.sex === 'F' ? s.femaleColor : '#f1f5f9';
  const border   = person.sex === 'M' ? '#2563eb' : person.sex === 'F' ? '#db2777' : '#94a3b8';

  return (
    <View style={{
      position: 'absolute',
      left, top,
      width:  s.cardWidth,
      height: s.cardHeight,
      borderRadius: s.borderRadius,
      padding: 6,
      backgroundColor: bgColor,
      borderLeftWidth: 3,
      borderLeftColor: border,
      borderLeftStyle: 'solid',
      ...(s.showBorder ? {
        borderWidth: 1,
        borderColor: s.borderColor,
        borderStyle: 'solid',
      } : {}),
      justifyContent: 'center',  // center content vertically
    }}>
      <Text style={{
        fontSize: s.nameFontSize,
        fontWeight: 'bold',
        color: BLUE,
        fontFamily: FONT,
        marginBottom: 2,
        textAlign: 'center',    // center name horizontally
      }}>
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
  root: TreeNode;
  format?: PageFormat;
  lang?: Lang;
  settings?: TreeSettings;
}

export function TreePdf({ root, format = 'A4L', lang = 'he', settings = defaultSettings }: Props) {
  const s = settings;
  const [pageW, pageH] = PAGE_SIZES[format];
  const usableW = pageW - MARGIN * 2;
  const coupleW = s.cardWidth * 2 + SPOUSE_GAP;

  const layout = buildLayout(root, usableW / 2, 0, s);
  const flat   = flattenLayout(layout);
  const conns  = collectConns(layout, s);

  const minX  = Math.min(...flat.map(n => n.x - coupleW / 2));
  const shift = minX < 0 ? -minX + s.hGap : 0;
  const maxX  = Math.max(...flat.map(n => n.x + coupleW / 2)) + shift;
  const maxY  = Math.max(...flat.map(n => n.y + s.cardHeight));

  const canvasW = Math.max(usableW, maxX + s.hGap);
  const canvasH = maxY + s.vGap;
  const rootName = getDisplayName(root.person, lang);

  return (
    <Document>
      <Page
        size={[Math.max(pageW, canvasW + MARGIN * 2), Math.max(pageH, canvasH + HEADER + MARGIN * 2)]}
        style={{ fontFamily: FONT, backgroundColor: '#f8fafc' }}
        wrap={false}
      >
        <View style={{ paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 }}>
          <Text style={{ fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT, textAlign: 'center', marginBottom: 2 }}>
            Family Tree — {rootName}
          </Text>
          <Text style={{ fontSize: 8, color: '#64748b', textAlign: 'center', fontFamily: FONT }}>
            Generated {new Date().toLocaleDateString()} · {format}
          </Text>
        </View>

        <View style={{ position: 'relative', marginHorizontal: MARGIN, width: canvasW, height: canvasH }}>

          {/* Connection lines */}
          <Svg width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0 }}>
            {conns.map((c, i) => {
              const px   = c.parentX + shift;
              const cx   = c.childX  + shift;
              const midY = (c.parentBottomY + c.childTopY) / 2;
              return (
                <React.Fragment key={i}>
                  <Line x1={px} y1={c.parentBottomY} x2={px} y2={midY} stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={px} y1={midY} x2={cx} y2={midY} stroke={s.lineColor} strokeWidth={1} />
                  <Line x1={cx} y1={midY} x2={cx} y2={c.childTopY} stroke={s.lineColor} strokeWidth={1} />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Person blocks */}
          {flat.map((item, i) => {
            const fam    = item.node.families[0];
            const spouse = fam?.spouse ?? null;
            const cx     = item.x + shift;
            const top    = item.y;

            if (spouse) {
              const husbLeft = cx - coupleW / 2;
              const wifeLeft = cx + SPOUSE_GAP / 2;
              const lineLeft = cx - SPOUSE_GAP / 2;
              const lineMidY = s.cardHeight / 2;
              const dateParts   = (fam?.marriageDate || '').split(' ');
              const hasFullDate = dateParts.length === 3;
              const dayMonth    = hasFullDate ? `${dateParts[0]} ${dateParts[1]}` : '';
              const year        = hasFullDate ? dateParts[2] : fam?.marriageDate || '';

              return (
                <React.Fragment key={i}>
                  <PersonCard person={item.node.person} left={husbLeft} top={top} lang={lang} s={s} />

                  <Svg width={SPOUSE_GAP} height={s.cardHeight} style={{ position: 'absolute', left: lineLeft, top }}>
                    <Line x1={0} y1={lineMidY} x2={SPOUSE_GAP} y2={lineMidY} stroke="#1a1a1a" strokeWidth={1.5} />
                  </Svg>

                  <Text style={{ position: 'absolute', left: cx - 6, top: top + lineMidY - 18, fontSize: 10, fontFamily: FONT, color: '#1a1a1a' }}>
                    ⚭
                  </Text>

                  {s.showMarriageDate && !!dayMonth && (
                    <Text style={{ position: 'absolute', left: lineLeft, top: top + lineMidY - 9, width: SPOUSE_GAP, fontSize: 7, color: '#1a1a1a', fontFamily: FONT, textAlign: 'center' }}>
                      {dayMonth}
                    </Text>
                  )}
                  {s.showMarriageDate && !!year && (
                    <Text style={{ position: 'absolute', left: lineLeft, top: top + lineMidY + 3, width: SPOUSE_GAP, fontSize: 7, color: '#1a1a1a', fontFamily: FONT, textAlign: 'center' }}>
                      {year}
                    </Text>
                  )}

                  <PersonCard person={spouse} left={wifeLeft} top={top} lang={lang} s={s} />
                </React.Fragment>
              );
            } else {
              return <PersonCard key={i} person={item.node.person} left={cx - s.cardWidth / 2} top={top} lang={lang} s={s} />;
            }
          })}
        </View>
      </Page>
    </Document>
  );
}