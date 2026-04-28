import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import { GedcomData } from '../parseGedcom';
import { buildReport1 } from './report1Stats';
import { buildReport2 } from './report2People';
import { buildReport3 } from './report3Problems';
import React from 'react';

// Helper to cast React elements to the type pdf() expects
function toPdfElement(el: React.ReactElement): Parameters<typeof pdf>[0] {
  return el as Parameters<typeof pdf>[0];
}

export async function generateAllReports(data: GedcomData): Promise<void> {
  const zip    = new JSZip();
  const folder = zip.folder('outputs')!;

  // Report 1 — Statistics PDF
  const r1blob = await pdf(toPdfElement(buildReport1(data))).toBlob();
  folder.file('report1-statistics.pdf', r1blob);

  // Report 2 — People list PDF
  const r2blob = await pdf(toPdfElement(buildReport2(data))).toBlob();
  folder.file('report2-people-list.pdf', r2blob);

  // Report 3 — Problems Excel
  const wb     = buildReport3(data);
  const r3buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  folder.file('report3-problems.xlsx', r3buf);

  // Download ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `family-tree-reports-${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}