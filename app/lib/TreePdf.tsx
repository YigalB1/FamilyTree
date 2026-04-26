import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Svg, Line } from '@react-pdf/renderer';
import { TreeNode } from './buildTree';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf', fontWeight: 'bold' },
  ],
});

const FONT       = 'NotoHebrew';
const BLUE       = '#1e3a5f';
const LIGHT      = '#e8f0fb';
const PINK       = '#fce8f0';
const LINE_COLOR = '#94a3b8';

const CARD_W   = 120;
const CARD_H   = 58;
const SPOUSE_H = 52;
const COUPLE_H = CARD_H + SPOUSE_H + 12;
const H_GAP    = 24;
const V_GAP    = 50;
const MARGIN   = 30;
const HEADER   = 36;

export type PageFormat = 'A4L' | 'A3L' | 'A1L' | 'A0L';

const PAGE_SIZES: Record<PageFormat, [number, number]> = {
  A4L: [841.89, 595.28],
  A3L: [1190.55, 841.89],
  A1L: [2383.94, 1683.78],
  A0L: [3370.39, 2383.94],
};

// ── Layout engine ────────────────────────────────

interface LayoutNode {
  node: TreeNode;
  x: number;
  y: number;
  width: number;
  children: LayoutNode[];
}

function subtreeWidth(node: TreeNode): number {
  const allChildren = node.families.flatMap(f => f.children);
  if (allChildren.length === 0) return CARD_W + H_GAP;
  return allChildren.reduce((sum, child) => sum + subtreeWidth(child), 0);
}

function buildLayout(node: TreeNode, x: number, y: number): LayoutNode {
  const allChildren = node.families.flatMap(f => f.children);
  const childY = y + COUPLE_H + V_GAP;
  const childLayouts: LayoutNode[] = [];
  let cursor = x - subtreeWidth(node) / 2;

  for (const child of allChildren) {
    const w = subtreeWidth(child);
    childLayouts.push(buildLayout(child, cursor + w / 2, childY));
    cursor += w;
  }

  return { node, x, y, width: subtreeWidth(node), children: childLayouts };
}

function flattenLayout(layout: LayoutNode, result: LayoutNode[] = []): LayoutNode[] {
  result.push(layout);
  for (const child of layout.children) flattenLayout(child, result);
  return result;
}

interface Connection {
  parentX: number; parentBottomY: number;
  childX: number;  childTopY: number;
}

function collectConnections(layout: LayoutNode, result: Connection[] = []): Connection[] {
  const parentBottomY = layout.y + COUPLE_H;
  for (const child of layout.children) {
    result.push({ parentX: layout.x, parentBottomY, childX: child.x, childTopY: child.y });
    collectConnections(child, result);
  }
  return result;
}

// ── Styles ───────────────────────────────────────

const styles = StyleSheet.create({
  page:      { fontFamily: FONT, backgroundColor: '#f8fafc' },
  header:    { paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 },
  title:     { fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT, textAlign: 'center', marginBottom: 2 },
  subtitle:  { fontSize: 8, color: '#64748b', textAlign: 'center', fontFamily: FONT },
  canvas:    { position: 'relative', marginHorizontal: MARGIN },
  card:      { position: 'absolute', borderRadius: 5, padding: 6, width: CARD_W },
  cardM:     { backgroundColor: LIGHT, borderLeft: '3pt solid #2563eb' },
  cardF:     { backgroundColor: PINK,  borderLeft: '3pt solid #db2777' },
  cardN:     { backgroundColor: '#f1f5f9', borderLeft: '3pt solid #94a3b8' },
  name:      { fontSize: 8, fontWeight: 'bold', color: BLUE, fontFamily: FONT, marginBottom: 2 },
  detail:    { fontSize: 6, color: '#64748b', fontFamily: FONT, marginBottom: 1 },
  marriage:  { position: 'absolute', fontSize: 6, color: '#7c3aed', fontFamily: FONT },
  connector: { position: 'absolute', fontSize: 9, color: '#7c3aed', fontFamily: FONT },
});

function cardStyle(sex: string) {
  if (sex === 'M') return [styles.card, styles.cardM];
  if (sex === 'F') return [styles.card, styles.cardF];
  return [styles.card, styles.cardN];
}

function PersonCard({ person, left, top, height }: {
  person: TreeNode['person']; left: number; top: number; height: number;
}) {
  return (
    <View style={[...cardStyle(person.sex), { left, top, height }]}>
      <Text style={styles.name}>{person.firstName} {person.lastName}</Text>
      {!!person.birthDate  && <Text style={styles.detail}>b. {person.birthDate}</Text>}
      {!!person.birthPlace && <Text style={styles.detail}>{person.birthPlace}</Text>}
      {!!person.deathDate  && <Text style={styles.detail}>d. {person.deathDate}</Text>}
    </View>
  );
}

// ── Main component ───────────────────────────────

interface Props { root: TreeNode; format?: PageFormat; }

export function TreePdf({ root, format = 'A4L' }: Props) {
  const [pageW, pageH] = PAGE_SIZES[format];
  const usableW = pageW - MARGIN * 2;
  const centerX = usableW / 2;

  const layout = buildLayout(root, centerX, 0);
  const flat   = flattenLayout(layout);
  const conns  = collectConnections(layout);

  // Shift all nodes so minimum x is always within bounds
  const minX = Math.min(...flat.map(n => n.x - CARD_W / 2));
  const shift = minX < 0 ? -minX + H_GAP : 0;

  const maxX = Math.max(...flat.map(n => n.x + CARD_W / 2)) + shift;
  const maxY = Math.max(...flat.map(n => n.y + COUPLE_H));

  // Canvas size — expand page if tree is wider
  const canvasW = Math.max(usableW, maxX + H_GAP);
  const canvasH = maxY + V_GAP;

  console.log('shift:', shift, 'canvasW:', canvasW, 'canvasH:', canvasH);
  console.log('sample card left:', flat[0].x + shift - CARD_W / 2, 'top:', flat[0].y);

  return (
    <Document>
      <Page
        size={[Math.max(pageW, canvasW + MARGIN * 2), Math.max(pageH, canvasH + HEADER + MARGIN * 2)]}
        style={styles.page}
        wrap={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            Family Tree — {root.person.firstName} {root.person.lastName}
          </Text>
          <Text style={styles.subtitle}>
            Generated {new Date().toLocaleDateString()} · {format}
          </Text>
        </View>

        {/* Canvas with SVG lines + cards */}
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>

          {/* Lines */}
          <Svg width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0 }}>
            {conns.map((c, i) => {
              const px = c.parentX + shift;
              const cx = c.childX  + shift;
              const midY = (c.parentBottomY + c.childTopY) / 2;
              return (
                <React.Fragment key={i}>
                  <Line x1={px} y1={c.parentBottomY} x2={px} y2={midY}
                    stroke={LINE_COLOR} strokeWidth={1} />
                  <Line x1={px} y1={midY} x2={cx} y2={midY}
                    stroke={LINE_COLOR} strokeWidth={1} />
                  <Line x1={cx} y1={midY} x2={cx} y2={c.childTopY}
                    stroke={LINE_COLOR} strokeWidth={1} />
                </React.Fragment>
              );
            })}
          </Svg>

          {/* Cards */}
          {flat.map((item, i) => {
            const fam    = item.node.families[0];
            const spouse = fam?.spouse ?? null;
            const left   = item.x + shift - CARD_W / 2;
            const top    = item.y;

            return (
              <React.Fragment key={i}>
                <PersonCard person={item.node.person} left={left} top={top} height={CARD_H} />

                {spouse && (
                  <>
                    <Text style={[styles.connector, { left: left + CARD_W / 2 - 5, top: top + CARD_H }]}>
                      ⚭
                    </Text>
                    {!!fam?.marriageDate && (
                      <Text style={[styles.marriage, { left: left + 16, top: top + CARD_H + 1 }]}>
                        {fam.marriageDate}
                      </Text>
                    )}
                    <PersonCard person={spouse} left={left} top={top + CARD_H + 12} height={SPOUSE_H} />
                  </>
                )}
              </React.Fragment>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}