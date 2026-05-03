import * as XLSX from 'xlsx';
import { QualityResult, QualityIssue } from '../dataQuality';

export function buildReport4(result: QualityResult): XLSX.WorkBook {
  // ── Summary sheet ─────────────────────────────────────────────
  const summary = [
    { Category: 'Scan date',          Value: new Date(result.scannedAt).toLocaleString() },
    { Category: 'People scanned',     Value: result.totalPeople   },
    { Category: 'Families scanned',   Value: result.totalFamilies },
    { Category: 'Total issues',       Value: result.errors.length + result.warnings.length + result.infos.length },
    { Category: 'Errors',             Value: result.errors.length   },
    { Category: 'Warnings',           Value: result.warnings.length },
    { Category: 'Info items',         Value: result.infos.length    },
  ]; // end summary

  // ── All issues sheet ──────────────────────────────────────────
  const allIssues: Record<string, string | number>[] = [
    ...result.errors,
    ...result.warnings,
    ...result.infos,
  ].map((issue: QualityIssue) => ({
    Severity:    issue.severity.toUpperCase(),
    Test:        issue.test,
    Person:      issue.personName,
    'Geni ID':   issue.geniId,
    Detail:      issue.detail,
  })); // end allIssues map

  // ── Errors sheet ──────────────────────────────────────────────
  const errors = result.errors.map((issue: QualityIssue) => ({
    Test:       issue.test,
    Person:     issue.personName,
    'Geni ID':  issue.geniId,
    Detail:     issue.detail,
  })); // end errors map

  // ── Warnings sheet ────────────────────────────────────────────
  const warnings = result.warnings.map((issue: QualityIssue) => ({
    Test:       issue.test,
    Person:     issue.personName,
    'Geni ID':  issue.geniId,
    Detail:     issue.detail,
  })); // end warnings map

  // ── Build workbook ────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary),   'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allIssues), 'All Issues');

  if (errors.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(errors), 'Errors');
  } // end if errors

  if (warnings.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(warnings), 'Warnings');
  } // end if warnings

  return wb;
} // end of buildReport4
