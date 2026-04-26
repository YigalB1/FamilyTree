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
const PURPLE     = '#7c3aed';

// Card dimensions
const CARD_W     = 110;  // single person card width
const CARD_H     = 62;   // card height
const SPOUSE_GAP = 18;   // gap between husband and wife cards (for ⚭ symbol)
const COUPLE_W   = CARD_W * 2 + SPOUSE_GAP; // total width of a couple block
const H_GAP      = 20;   // horizontal gap between sibling couples
const V_GAP      = 60;   // vertical gap between generations
const MARGIN     = 30;
const HEADER     = 38;

export type PageFormat = 'A4L' | 'A3L' | 'A1L' | 'A0L';

const PAGE_SIZES: Record<PageFormat, [number, number]> = {
  A4L: [841.89, 595.28],
  A3L: [1190.55, 841.89],
  A1L: [2383.94, 1683.78],
  A0L: [3370.39, 2383.94],
};

// ── Layout engine ─────────────────────────────────────────────────
// x = center of the COUPLE block (or single card if no spouse)

interface LayoutNode {
  node: TreeNode;
  x: number;       // center x of this block
  y: number;       // top y of this block
  width: number;   // total subtree width
  children: LayoutNode[];
}

function blockWidth(node: TreeNode): number {
  const fam = node.families[0];
  return fam?.spouse ? COUPLE_W : CARD_W;
}

function subtreeWidth(node: TreeNode): number {
  const allChildren = node.families.flatMap(f => f.children);
  if (allChildren.length === 0) return blockWidth(node) + H_GAP;
  const childrenW = allChildren.reduce((sum, child) => sum + subtreeWidth(child), 0);
  return Math.max(childrenW, blockWidth(node) + H_GAP);
}

function buildLayout(node: TreeNode, x: number, y: number): LayoutNode {
  const allChildren = node.families.flatMap(f => f.children);
  const childY = y + CARD_H + V_GAP;
  const childLayouts: LayoutNode[] = [];

  const totalChildW = allChildren.reduce((sum, c) => sum + subtreeWidth(c), 0);
  let cursor = x - totalChildW / 2;

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
  // Connection drops from center-bottom of the couple block
  const parentBottomY = layout.y + CARD_H;
  for (const child of layout.children) {
    result.push({
      parentX: layout.x,
      parentBottomY,
      childX: child.x,
      childTopY: child.y,
    });
    collectConnections(child, result);
  }
  return result;
}

// ── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page:     { fontFamily: FONT, backgroundColor: '#f8fafc' },
  header:   { paddingTop: MARGIN, paddingHorizontal: MARGIN, paddingBottom: 6 },
  title:    { fontSize: 16, color: BLUE, fontWeight: 'bold', fontFamily: FONT, textAlign: 'center', marginBottom: 2 },
  subtitle: { fontSize: 8, color: '#64748b', textAlign: 'center', fontFamily: FONT },
  canvas:   { position: 'relative', marginHorizontal: MARGIN },
  card:     { position: 'absolute', borderRadius: 5, padding: 6, width: CARD_W, height: CARD_H },
  cardM:    { backgroundColor: LIGHT, borderLeft: '3pt solid #2563eb' },
  cardF:    { backgroundColor: PINK,  borderLeft: '3pt solid #db2777' },
  cardN:    { backgroundColor: '#f1f5f9', borderLeft: '3pt solid #94a3b8' },
  name:     { fontSize: 8, fontWeight: 'bold', color: BLUE, fontFamily: FONT, marginBottom: 2 },
  detail:   { fontSize: 6, color: '#64748b', fontFamily: FONT, marginBottom: 1 },
  symbol:   { position: 'absolute', fontSize: 10, color: PURPLE, fontFamily: FONT },
  mdate:    { position: 'absolute', fontSize: 5, color: PURPLE, fontFamily: FONT, textAlign: 'center' },
});

function cardStyle(sex: string) {
  if (sex === 'M') return [styles.card, styles.cardM];
  if (sex === 'F') return [styles.card, styles.cardF];
  return [styles.card, styles.cardN];
}

function PersonCard({ person, left, top }: {
  person: TreeNode['person']; left: number; top: number;
}) {
  return (
    <View style={[...cardStyle(person.sex), { left, top }]}>
      <Text style={styles.name}>{person.firstName} {person.lastName}</Text>
      {!!person.birthDate  && <Text style={styles.detail}>b. {person.birthDate}</Text>}
      {!!person.birthPlace && <Text style={styles.detail}>{person.birthPlace}</Text>}
      {!!person.deathDate  && <Text style={styles.detail}>d. {person.deathDate}</Text>}
    </View>
  );
}

// ── Main PDF ──────────────────────────────────────────────────────

interface Props { root: TreeNode; format?: PageFormat; }

export function TreePdf({ root, format = 'A4L' }: Props) {
  const [pageW, pageH] = PAGE_SIZES[format];
  const usableW = pageW - MARGIN * 2;

  const layout = buildLayout(root, usableW / 2, 0);
  const flat   = flattenLayout(layout);
  const conns  = collectConnections(layout);

  // Shift everything right if any card goes negative
  const minX  = Math.min(...flat.map(n => n.x - COUPLE_W / 2));
  const shift = minX < 0 ? -minX + H_GAP : 0;

  const maxX  = Math.max(...flat.map(n => n.x + COUPLE_W / 2)) + shift;
  const maxY  = Math.max(...flat.map(n => n.y + CARD_H));

  const canvasW = Math.max(usableW, maxX + H_GAP);
  const canvasH = maxY + V_GAP;

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

        {/* Canvas */}
        <View style={[styles.canvas, { width: canvasW, height: canvasH }]}>

          {/* SVG lines */}
          <Svg width={canvasW} height={canvasH} style={{ position: 'absolute', top: 0, left: 0 }}>
            {conns.map((c, i) => {
              const px  = c.parentX + shift;
              const cx  = c.childX  + shift;
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

          {/* Couple blocks */}
          {flat.map((item, i) => {
            const fam    = item.node.families[0];
            const spouse = fam?.spouse ?? null;
            const cx     = item.x + shift; // center x of this block
            const top    = item.y;

            if (spouse) {
              // Couple: husband left, ⚭ in middle, wife right
              const husbLeft   = cx - COUPLE_W / 2;
              const symbolLeft = cx - SPOUSE_GAP / 2 - 4;
              const wifeLeft   = cx + SPOUSE_GAP / 2;

              return (
                <React.Fragment key={i}>
                  <PersonCard person={item.node.person} left={husbLeft} top={top} />
                  {/* Marriage symbol */}
                  <Text style={[styles.symbol, { left: symbolLeft, top: top + CARD_H / 2 - 8 }]}>
                    ⚭
                  </Text>
                  {/* Marriage date below symbol */}
                  {!!fam?.marriageDate && (
                    <Text style={[styles.mdate, { left: symbolLeft - 6, top: top + CARD_H / 2 + 4, width: SPOUSE_GAP + 12 }]}>
                      {fam.marriageDate}
                    </Text>
                  )}
                  <PersonCard person={spouse} left={wifeLeft} top={top} />
                </React.Fragment>
              );
            } else {
              // Single person — center the card
              return (
                <PersonCard
                  key={i}
                  person={item.node.person}
                  left={cx - CARD_W / 2}
                  top={top}
                />
              );
            }
          })}

        </View>
      </Page>
    </Document>
  );
}