import JSZip from 'jszip';
import { pdf } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import { GedcomData } from '../parseGedcom';
import { buildReport1 } from './report1Stats';
import { buildReport2 } from './report2People';
import { buildReport3 } from './report3Problems';
import React from 'react';

function toPdfElement(el: React.ReactElement): Parameters<typeof pdf>[0] {
  return el as Parameters<typeof pdf>[0];
}

export async function generateAllReports(data: GedcomData): Promise<void> {
  try {
    console.log('Starting report generation...');
    const zip    = new JSZip();
    const folder = zip.folder('outputs')!;

    console.log('Generating report 1...');
    const r1blob = await pdf(toPdfElement(buildReport1(data))).toBlob();
    folder.file('report1-statistics.pdf', r1blob);
    console.log('Report 1 done');

    console.log('Generating report 2...');
    const r2blob = await pdf(toPdfElement(buildReport2(data))).toBlob();
    folder.file('report2-people-list.pdf', r2blob);
    console.log('Report 2 done');

    console.log('Generating report 3...');
    const wb     = buildReport3(data);
    const r3buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    folder.file('report3-problems.xlsx', r3buf);
    console.log('Report 3 done');

    console.log('Generating ZIP...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `family-tree-reports-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('Done!');
  } catch (err) {
    console.error('Report generation failed:', err);
  }
}