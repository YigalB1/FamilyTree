import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { TreeNode } from './buildTree';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf', fontWeight: 'bold' },
  ],
});

const FONT  = 'NotoHebrew';
const BLUE  = '#1e3a5f';
const LIGHT = '#e8f0fb';
const PINK  = '#fce8f0';

const styles = StyleSheet.create({
  page:      { padding: 30, fontFamily: FONT, backgroundColor: '#f8fafc' },
  title:     { fontSize: 20, color: BLUE, fontWeight: 'bold', fontFamily: FONT, marginBottom: 4, textAlign: 'center' },
  subtitle:  { fontSize: 10, color: '#64748b', marginBottom: 20, textAlign: 'center', fontFamily: FONT },
  genLabel:  { fontSize: 8, color: '#94a3b8', marginBottom: 4, marginTop: 10, fontFamily: FONT },
  row:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  card:      { borderRadius: 6, padding: 8, minWidth: 130, maxWidth: 160, marginBottom: 4 },
  cardM:     { backgroundColor: LIGHT, borderLeft: '3pt solid #2563eb' },
  cardF:     { backgroundColor: PINK,  borderLeft: '3pt solid #db2777' },
  cardN:     { backgroundColor: '#f1f5f9', borderLeft: '3pt solid #94a3b8' },
  name:      { fontSize: 9, fontWeight: 'bold', color: BLUE, marginBottom: 2, fontFamily: FONT },
  detail:    { fontSize: 7, color: '#64748b', marginBottom: 1, fontFamily: FONT },
  marriage:  { fontSize: 7, color: '#7c3aed', marginTop: 1, marginBottom: 2, fontFamily: FONT },
  connector: { fontSize: 8, color: '#94a3b8', marginVertical: 1, fontFamily: FONT },
});

function cardStyle(sex: string) {
  if (sex === 'M') return [styles.card, styles.cardM];
  if (sex === 'F') return [styles.card, styles.cardF];
  return [styles.card, styles.cardN];
}

interface Entry {
  person: TreeNode['person'];
  spouse: TreeNode['person'] | null;
  marriageDate: string;
  marriagePlace: string;
}

function collectGenerations(
  node: TreeNode,
  gen = 0,
  gens: Map<number, Entry[]> = new Map()
): Map<number, Entry[]> {
  if (!gens.has(gen)) gens.set(gen, []);

  if (node.families.length === 0) {
    gens.get(gen)!.push({ person: node.person, spouse: null, marriageDate: '', marriagePlace: '' });
  } else {
    for (const fam of node.families) {
      gens.get(gen)!.push({
        person: node.person,
        spouse: fam.spouse,
        marriageDate: fam.marriageDate,
        marriagePlace: fam.marriagePlace,
      });
      for (const child of fam.children) {
        collectGenerations(child, gen + 1, gens);
      }
    }
  }
  return gens;
}

const GEN_NAMES = [
  '1st Generation', '2nd Generation', '3rd Generation', '4th Generation',
  '5th Generation', '6th Generation', '7th Generation', '8th Generation',
];

function PersonCard({ person }: { person: TreeNode['person'] }) {
  return (
    <View style={cardStyle(person.sex)}>
      <Text style={styles.name}>{person.firstName} {person.lastName}</Text>
      {!!person.birthDate  && <Text style={styles.detail}>b. {person.birthDate}</Text>}
      {!!person.birthPlace && <Text style={styles.detail}>{person.birthPlace}</Text>}
      {!!person.deathDate  && <Text style={styles.detail}>d. {person.deathDate}</Text>}
    </View>
  );
}

interface Props { root: TreeNode; }

export function TreePdf({ root }: Props) {
  const gens = collectGenerations(root);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>
          Family Tree — {root.person.firstName} {root.person.lastName}
        </Text>
        <Text style={styles.subtitle}>
          Generated {new Date().toLocaleDateString()}
        </Text>

        {Array.from(gens.entries()).map(([gen, entries]) => (
          <View key={gen}>
            <Text style={styles.genLabel}>
              {GEN_NAMES[gen] || `Generation ${gen + 1}`}
            </Text>
            <View style={styles.row}>
              {entries.map((entry, i) => (
                <View key={i}>
                  <PersonCard person={entry.person} />
                  {entry.spouse && (
                    <>
                      <Text style={styles.connector}>⚭</Text>
                      {!!entry.marriageDate && (
                        <Text style={styles.marriage}>m. {entry.marriageDate}</Text>
                      )}
                      <PersonCard person={entry.spouse} />
                    </>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}