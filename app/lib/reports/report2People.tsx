import React from 'react';
import { Document, Page, Text, View, Font } from '@react-pdf/renderer';
import { GedcomData } from '../parseGedcom';
import { getBothNames, getSpouseNames, getParentNames, getChildrenNames } from './reportUtils';

Font.register({
  family: 'NotoHebrew',
  fonts: [
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Regular.ttf', fontWeight: 'normal' },
    { src: 'http://localhost:3000/fonts/NotoSansHebrew-Bold.ttf',    fontWeight: 'bold'   },
  ],
});

const FONT = 'NotoHebrew';
const BLUE = '#1e3a5f';

export function buildReport2(data: GedcomData): React.ReactElement {
  const persons = [...data.persons];

  return (
    <Document>
      <Page size="A4" style={{ fontFamily: FONT, padding: 30, backgroundColor: '#fff' }} wrap>

        <Text style={{ fontSize: 16, fontWeight: 'bold', color: BLUE, fontFamily: FONT, textAlign: 'center', marginBottom: 4 }}>
          Family Tree — People List
        </Text>
        <Text style={{ fontSize: 8, color: '#64748b', fontFamily: FONT, textAlign: 'center', marginBottom: 16 }}>
          Generated {new Date().toLocaleDateString()} · {persons.length} people · GEDCOM order
        </Text>

        {/* Header row */}
        <View style={{
          flexDirection: 'row', backgroundColor: BLUE,
          padding: 6, borderRadius: 4, marginBottom: 2,
        }}>
          {[
            { label: '#',          w: 22  },
            { label: 'Name',       w: 120 },
            { label: 'Born',       w: 65  },
            { label: 'Sex',        w: 20  },
            { label: 'Spouse(s)',  w: 90  },
            { label: 'Parents',    w: 90  },
            { label: 'Children',   flex: 1 },
          ].map((col, i) => (
            <Text key={i} style={{
              fontSize: 7, color: '#fff', fontFamily: FONT,
              width: col.w, flex: col.flex,
            }}>
              {col.label}
            </Text>
          ))}
        </View>

        {/* Data rows */}
        {persons.map((p, i) => (
          <View key={p.id} wrap={false} style={{
            flexDirection: 'row',
            backgroundColor: i % 2 === 0 ? '#f8fafc' : '#fff',
            padding: 5,
            borderBottomWidth: 0.5,
            borderBottomColor: '#e2e8f0',
            borderBottomStyle: 'solid',
          }}>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#94a3b8', width: 22 }}>{i + 1}</Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: BLUE,      width: 120 }}>{getBothNames(p)}</Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#475569', width: 65  }}>{p.birthDate || '—'}</Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#475569', width: 20  }}>
              {p.sex === 'M' ? 'M' : p.sex === 'F' ? 'F' : '—'}
            </Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#475569', width: 90  }}>
              {getSpouseNames(p, data) || '—'}
            </Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#475569', width: 90  }}>
              {getParentNames(p, data) || '—'}
            </Text>
            <Text style={{ fontSize: 6.5, fontFamily: FONT, color: '#475569', flex: 1 }}>
              {getChildrenNames(p, data) || '—'}
            </Text>
          </View>
        ))}

      </Page>
    </Document>
  );
}