'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface QualityIssue {
  personId:   string;
  personName: string;
  geniId:     string;
  test:       string;
  detail:     string;
  severity:   'error' | 'warning' | 'info';
} // end of QualityIssue interface

interface QualityResult {
  errors:        QualityIssue[];
  warnings:      QualityIssue[];
  infos:         QualityIssue[];
  totalPeople:   number;
  totalFamilies: number;
  scannedAt:     string;
} // end of QualityResult interface

const SEVERITY_CONFIG = {
  error: {
    label:  '❌ Errors',
    bg:     'bg-red-50',
    border: 'border-red-200',
    badge:  'bg-red-100 text-red-700',
    count:  'text-red-600',
  },
  warning: {
    label:  '⚠️ Warnings',
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    badge:  'bg-amber-100 text-amber-700',
    count:  'text-amber-600',
  },
  info: {
    label:  'ℹ️ Info',
    bg:     'bg-blue-50',
    border: 'border-blue-200',
    badge:  'bg-blue-100 text-blue-700',
    count:  'text-blue-600',
  },
} as const; // end of SEVERITY_CONFIG

export default function QualityPage() {
  const [result,  setResult]  = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState<'all' | 'error' | 'warning' | 'info'>('all');

  // ── Load quality results ────────────────────────────────────────
  async function runScan() {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/quality');
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Failed to run quality checks');
    } finally {
      setLoading(false);
    }
  } // end of runScan

  useEffect(() => { runScan(); }, []); // end useEffect

  // ── CSV download ────────────────────────────────────────────────
  function downloadCsv() {
    if (!result) return;
    const all = [...result.errors, ...result.warnings, ...result.infos];
    const rows = [
      ['Severity', 'Test', 'Person', 'Geni ID', 'Detail'],
      ...all.map(i => [
        i.severity,
        i.test,
        i.personName,
        i.geniId,
        i.detail,
      ])
    ];
    const csv     = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `data-quality-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } // end of downloadCsv

  // ── Filtered issues ─────────────────────────────────────────────
  function getFilteredIssues(): QualityIssue[] {
    if (!result) return [];
    if (filter === 'error')   return result.errors;
    if (filter === 'warning') return result.warnings;
    if (filter === 'info')    return result.infos;
    return [...result.errors, ...result.warnings, ...result.infos];
  } // end of getFilteredIssues

  const totalIssues = result
    ? result.errors.length + result.warnings.length + result.infos.length
    : 0;

  // ── Issue row ───────────────────────────────────────────────────
  function IssueRow({ issue }: { issue: QualityIssue }) {
    const cfg = SEVERITY_CONFIG[issue.severity];
    return (
      <div className={`flex items-start gap-4 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
              {issue.test}
            </span>
            <Link href={`/person/${issue.personId}`}
              className="font-semibold text-blue-800 hover:underline text-sm">
              {issue.personName}
            </Link>
            {issue.geniId && (
              <span className="text-xs text-gray-400">{issue.geniId}</span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{issue.detail}</p>
        </div>
        <Link
          href={`/person/${issue.personId}`}
          className="text-xs bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1 rounded-lg whitespace-nowrap"
        >
          View →
        </Link>
      </div>
    );
  } // end of IssueRow

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">🔍 Data Quality Check</h1>
        <div className="flex gap-2">
          {result && totalIssues > 0 && (
            <button
              onClick={downloadCsv}
              className="bg-green-600 hover:bg-green-500 px-3 py-1 rounded-lg text-xs font-medium"
            >
              ⬇ Download CSV
            </button>
          )}
          <button
            onClick={runScan}
            disabled={loading}
            className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {loading ? '⏳ Scanning…' : '🔄 Re-scan'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-20">
            <p className="text-blue-600 animate-pulse text-lg">Scanning database…</p>
          </div>
        )}

        {/* Results */}
        {!loading && result && (
          <div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-xl shadow p-4 text-center">
                <p className="text-3xl font-bold text-gray-700">{result.totalPeople}</p>
                <p className="text-sm text-gray-500">People scanned</p>
              </div>
              <div className={`rounded-xl shadow p-4 text-center ${result.errors.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-white'}`}>
                <p className={`text-3xl font-bold ${SEVERITY_CONFIG.error.count}`}>
                  {result.errors.length}
                </p>
                <p className="text-sm text-gray-500">Errors</p>
              </div>
              <div className={`rounded-xl shadow p-4 text-center ${result.warnings.length > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-white'}`}>
                <p className={`text-3xl font-bold ${SEVERITY_CONFIG.warning.count}`}>
                  {result.warnings.length}
                </p>
                <p className="text-sm text-gray-500">Warnings</p>
              </div>
              <div className="bg-white rounded-xl shadow p-4 text-center">
                <p className={`text-3xl font-bold ${SEVERITY_CONFIG.info.count}`}>
                  {result.infos.length}
                </p>
                <p className="text-sm text-gray-500">Info</p>
              </div>
            </div>

            {/* All clear */}
            {totalIssues === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-xl font-bold text-green-800">All clear!</p>
                <p className="text-green-600 mt-1">No data quality issues found in {result.totalPeople} people.</p>
              </div>
            )}

            {/* Filter tabs + issues */}
            {totalIssues > 0 && (
              <>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {([
                    { key: 'all',     label: `All (${totalIssues})` },
                    { key: 'error',   label: `❌ Errors (${result.errors.length})` },
                    { key: 'warning', label: `⚠️ Warnings (${result.warnings.length})` },
                    { key: 'info',    label: `ℹ️ Info (${result.infos.length})` },
                  ] as const).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                        ${filter === tab.key
                          ? 'bg-blue-700 text-white'
                          : 'bg-white shadow text-gray-600 hover:bg-gray-50'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {getFilteredIssues().map((issue, i) => (
                    <IssueRow key={`${issue.personId}-${issue.test}-${i}`} issue={issue} />
                  ))}
                </div>
              </>
            )} {/* end if issues */}

            {/* Scan timestamp */}
            <p className="text-xs text-gray-400 text-center mt-6">
              Scanned at {new Date(result.scannedAt).toLocaleString()}
            </p>

          </div>
        )} {/* end results */}

      </div>
    </main>
  );
} // end of QualityPage
