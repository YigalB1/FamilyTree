import React from 'react';
import { Document, Page, Text, View, Font } from '@react-pdf/renderer';
import { GedcomData } from '../parseGedcom';
import { getAge, isAlive, parseYear, currentYear } from './reportUtils';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const FONT = 'NotoHebrew';
const BLUE = '#1e3a5f';
const TEAL = '#0d9488';
const RED  = '#dc2626';

function StatBox({ label, value, color = BLUE }: {
  label: string; value: string | number; color?: string;
}) {
  return (
    <View style={{
      backgroundColor: '#f1f5f9', borderRadius: 6, padding: 12,
      margin: 4, width: 120, alignItems: 'center',
    }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color, fontFamily: FONT }}>{value}</Text>
      <Text style={{ fontSize: 8, color: '#64748b', fontFamily: FONT, textAlign: 'center', marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

function BarChart({ data, maxVal }: { data: { label: string; count: number }[]; maxVal: number }) {
  return (
    <View style={{ marginTop: 8 }}>
      {data.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text style={{ fontSize: 7, fontFamily: FONT, color: '#64748b', width: 50 }}>{row.label}</Text>
          <View style={{
            height: 14,
            width: maxVal > 0 ? (row.count / maxVal) * 280 : 0,
            backgroundColor: TEAL,
            borderRadius: 2,
            marginRight: 6,
          }} />
          <Text style={{ fontSize: 7, fontFamily: FONT, color: BLUE }}>{row.count}</Text>
        </View>
      ))}
    </View>
  );
}

export function buildReport1(data: GedcomData): React.ReactElement {
  const persons  = data.persons;
  const total    = persons.length;
  const alive    = persons.filter(isAlive).length;
  const deceased = total - alive;
  const males    = persons.filter(p => p.sex === 'M').length;
  const females  = persons.filter(p => p.sex === 'F').length;
  const cy       = currentYear();

  // Age buckets
  const labels  = ['0-10','11-20','21-30','31-40','41-50','51-60','61-70','71-80','81-90','91-100','100+'];
  const buckets: Record<string, number> = {};
  labels.forEach(l => buckets[l] = 0);
  persons.forEach(p => {
    const age = getAge(p);
    if (age === null || age < 0) return;
    if      (age <= 10)  buckets['0-10']++;
    else if (age <= 20)  buckets['11-20']++;
    else if (age <= 30)  buckets['21-30']++;
    else if (age <= 40)  buckets['31-40']++;
    else if (age <= 50)  buckets['41-50']++;
    else if (age <= 60)  buckets['51-60']++;
    else if (age <= 70)  buckets['61-70']++;
    else if (age <= 80)  buckets['71-80']++;
    else if (age <= 90)  buckets['81-90']++;
    else if (age <= 100) buckets['91-100']++;
    else                 buckets['100+']++;
  });
  const barData = labels.map(l => ({ label: l, count: buckets[l] }));
  const maxVal  = Math.max(...barData.map(b => b.count), 1);

  // Avg lifespan
  const lifespans = persons
    .filter(p => p.deathDate && p.birthDate)
    .map(p => getAge(p))
    .filter((a): a is number => a !== null && a > 0);
  const avgLifespan = lifespans.length > 0
    ? Math.round(lifespans.reduce((a, b) => a + b, 0) / lifespans.length)
    : null;

  // Oldest
  const oldest = persons
    .filter(p => p.birthDate)
    .sort((a, b) => (parseYear(a.birthDate) || 9999) - (parseYear(b.birthDate) || 9999))[0];

  // Avg children
  const avgChildren = data.families.length > 0
    ? (data.families.reduce((s, f) => s + f.childrenIds.length, 0) / data.families.length).toFixed(1)
    : '0';

  // Top birth places
  const placeCounts: Record<string, number> = {};
  persons.forEach(p => {
    if (!p.birthPlace) return;
    const country = p.birthPlace.split(',').pop()?.trim() || p.birthPlace;
    placeCounts[country] = (placeCounts[country] || 0) + 1;
  });
  const topPlaces = Object.entries(placeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: FONT, padding: 40, backgroundColor: '#f8fafc' }}>

        <Text style={{ fontSize: 20, fontWeight: 'bold', color: BLUE, fontFamily: FONT, textAlign: 'center', marginBottom: 4 }}>
          Family Tree — Statistics Report
        </Text>
        <Text style={{ fontSize: 9, color: '#64748b', fontFamily: FONT, textAlign: 'center', marginBottom: 20 }}>
          Generated {new Date().toLocaleDateString()}
        </Text>

        {/* Summary boxes */}
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: BLUE, fontFamily: FONT, marginBottom: 8 }}>
          Summary
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
          <StatBox label="Total People"          value={total}              />
          <StatBox label="Living"                value={alive}    color={TEAL} />
          <StatBox label="Deceased"              value={deceased} color={RED}  />
          <StatBox label="Male"                  value={males}              />
          <StatBox label="Female"                value={females}            />
          <StatBox label="Families"              value={data.families.length} />
          <StatBox label="Avg Children / Family" value={avgChildren}        />
          {avgLifespan !== null && (
            <StatBox label="Avg Lifespan (yrs)" value={avgLifespan} />
          )}
        </View>

        {oldest && (
          <Text style={{ fontSize: 8, color: '#64748b', fontFamily: FONT, marginBottom: 16 }}>
            Oldest recorded: {oldest.firstName} {oldest.lastName} — born {oldest.birthDate}
          </Text>
        )}

        {/* Age distribution */}
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: BLUE, fontFamily: FONT, marginBottom: 6 }}>
          Age Distribution
        </Text>
        <BarChart data={barData} maxVal={maxVal} />

        {/* Top birth places */}
        {topPlaces.length > 0 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: BLUE, fontFamily: FONT, marginTop: 20, marginBottom: 6 }}>
              Top Birth Countries / Places
            </Text>
            {topPlaces.map(([place, count], i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ fontSize: 8, fontFamily: FONT, color: BLUE, width: 220 }}>{place}</Text>
                <Text style={{ fontSize: 8, fontFamily: FONT, color: '#64748b' }}>{count} people</Text>
              </View>
            ))}
          </>
        )}

      </Page>
    </Document>
  );
}
