import JSZip   from 'jszip';
import { pdf } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import React from 'react';
import { GedcomData }   from '../parseGedcom';
import { buildReport1 } from './report1Stats';
import { buildReport2 } from './report2People';
import { buildReport3 } from './report3Problems';
import { buildReport4 } from './report4Quality';

// Helper to cast React elements to the type pdf() expects
function toPdfElement(el: React.ReactElement): Parameters<typeof pdf>[0] {
  return el as Parameters<typeof pdf>[0];
} // end of toPdfElement

export async function generateAllReports(data: GedcomData): Promise<void> {
  const zip    = new JSZip();
  const folder = zip.folder('outputs')!;

  // Timestamp for all filenames — e.g. 2026-05-03_14-30-00
  const ts = new Date().toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .split('.')[0];

  // Report 1 — Statistics PDF
  const r1blob = await pdf(toPdfElement(buildReport1(data))).toBlob();
  folder.file(`report1-statistics_${ts}.pdf`, r1blob);

  // Report 2 — People list PDF
  const r2blob = await pdf(toPdfElement(buildReport2(data))).toBlob();
  folder.file(`report2-people-list_${ts}.pdf`, r2blob);

  // Report 3 — Problems Excel (from localStorage GEDCOM data)
  const wb3   = buildReport3(data);
  const r3buf = XLSX.write(wb3, { bookType: 'xlsx', type: 'array' });
  folder.file(`report3-problems_${ts}.xlsx`, r3buf);

  // Report 4 — Data Quality Excel (from database scan via API)
  try {
    const res         = await fetch('/api/quality');
    const qualityResult = await res.json();
    const wb4   = buildReport4(qualityResult);
    const r4buf = XLSX.write(wb4, { bookType: 'xlsx', type: 'array' });
    folder.file(`report4-data-quality_${ts}.xlsx`, r4buf);
  } catch (err) {
    console.warn('Data quality report skipped (database may not be available):', err);
    // Don't fail the whole ZIP if DB quality check fails
  } // end try/catch quality

  // Download ZIP — also timestamped
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `family-tree-reports_${ts}.zip`;
  a.click();
  URL.revokeObjectURL(url);
} // end of generateAllReports
