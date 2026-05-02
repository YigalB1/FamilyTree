'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ChangeLogEntry {
  id:               string;
  table_name:       string;
  record_id:        string;
  field:            string;
  old_value:        string;
  new_value:        string;
  changed_at:       string;
  source:           string;
  changed_by_name:  string;
  first_name_he:    string;
  last_name_he:     string;
  first_name_en:    string;
  last_name_en:     string;
  geni_id:          string;
} // end of ChangeLogEntry interface

interface ChangeLogResult {
  entries:    ChangeLogEntry[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
  fields:     string[];
} // end of ChangeLogResult interface

const SOURCE_LABELS: Record<string, string> = {
  manual: '✏️ Manual edit',
  import: '📥 Import',
  merge:  '🔀 Merge',
  system: '⚙️ System',
}; // end SOURCE_LABELS

const FIELD_LABELS: Record<string, string> = {
  first_name_he: 'First name (Hebrew)',
  last_name_he:  'Last name (Hebrew)',
  first_name_en: 'First name (English)',
  last_name_en:  'Last name (English)',
  sex:           'Sex',
  birth_date:    'Birth date',
  birth_place:   'Birth place',
  death_date:    'Death date',
  death_place:   'Death place',
  notes:         'Notes',
  geni_id:       'Geni ID',
}; // end FIELD_LABELS

export default function ChangeLogPage() {
  const [result,   setResult]   = useState<ChangeLogResult | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  // Filters
  const [search,   setSearch]   = useState('');
  const [field,    setField]    = useState('');
  const [source,   setSource]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page,     setPage]     = useState(1);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (search)   params.set('search',   search);
      if (field)    params.set('field',    field);
      if (source)   params.set('source',   source);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo',   dateTo);
      params.set('page', String(page));

      const res  = await fetch(`/api/changelog?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Failed to load change log');
    } finally {
      setLoading(false);
    }
  }, [search, field, source, dateFrom, dateTo, page]); // end loadData deps

  useEffect(() => { loadData(); }, [loadData]); // end useEffect

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, field, source, dateFrom, dateTo]); // end useEffect reset page

  function personName(entry: ChangeLogEntry): string {
    const he = `${entry.first_name_he || ''} ${entry.last_name_he || ''}`.trim();
    const en = `${entry.first_name_en || ''} ${entry.last_name_en || ''}`.trim();
    return he || en || entry.record_id.slice(0, 8) + '…';
  } // end of personName

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  } // end of formatDate

  function sourceColor(src: string): string {
    switch (src) {
      case 'manual': return 'bg-blue-100 text-blue-700';
      case 'import': return 'bg-green-100 text-green-700';
      case 'merge':  return 'bg-purple-100 text-purple-700';
      default:       return 'bg-gray-100 text-gray-600';
    } // end switch
  } // end of sourceColor

  function clearFilters() {
    setSearch('');
    setField('');
    setSource('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  } // end of clearFilters

  const hasFilters = search || field || source || dateFrom || dateTo;

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">📋 Change Log</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-6xl mx-auto p-8">

        {/* Summary */}
        {result && (
          <div className="bg-white rounded-2xl shadow px-6 py-4 mb-6 flex items-center justify-between">
            <div>
              <span className="text-2xl font-bold text-blue-900">{result.total.toLocaleString()}</span>
              <span className="text-gray-500 ml-2 text-sm">total changes</span>
              {hasFilters && (
                <span className="ml-3 text-sm text-amber-600">
                  (filtered — <button onClick={clearFilters} className="underline hover:no-underline">clear filters</button>)
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400">
              Page {result.page} of {result.totalPages}
            </div>
          </div>
        )} {/* end summary */}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Filters</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">

            {/* Search */}
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Search (name or value)
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            {/* Field filter */}
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Field
              <select
                value={field}
                onChange={e => setField(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All fields</option>
                {result?.fields.map(f => (
                  <option key={f} value={f}>{FIELD_LABELS[f] || f}</option>
                ))}
              </select>
            </label>

            {/* Source filter */}
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              Source
              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">All sources</option>
                <option value="manual">Manual edit</option>
                <option value="import">Import</option>
                <option value="merge">Merge</option>
                <option value="system">System</option>
              </select>
            </label>

            {/* Date from */}
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              From date
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            {/* Date to */}
            <label className="flex flex-col gap-1 text-sm text-gray-600">
              To date
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </label>

            {/* Clear button */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                ↺ Clear filters
              </button>
            </div>

          </div>
        </div> {/* end filters */}

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-center text-blue-600 animate-pulse py-12">Loading…</p>
        )}

        {/* Change log table */}
        {!loading && result && (
          <div className="bg-white rounded-2xl shadow overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3">Person</th>
                  <th className="text-left px-4 py-3">Field</th>
                  <th className="text-left px-4 py-3">Old value</th>
                  <th className="text-left px-4 py-3">New value</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-left px-4 py-3">Changed by</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {result.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                      No changes found
                    </td>
                  </tr>
                ) : (
                  result.entries.map((entry, i) => (
                    <tr key={entry.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>

                      {/* Person name — links to profile */}
                      <td className="px-4 py-2">
                        <Link
                          href={`/person/${entry.record_id}`}
                          className="font-medium hover:text-blue-700 hover:underline"
                        >
                          {personName(entry)}
                        </Link>
                      </td>

                      {/* Field */}
                      <td className="px-4 py-2 text-gray-600">
                        {FIELD_LABELS[entry.field] || entry.field}
                      </td>

                      {/* Old value */}
                      <td className="px-4 py-2">
                        {entry.old_value
                          ? <span className="text-red-500 line-through">{entry.old_value}</span>
                          : <span className="text-gray-300 italic">—</span>
                        }
                      </td>

                      {/* New value */}
                      <td className="px-4 py-2">
                        {entry.new_value
                          ? <span className="text-green-600">{entry.new_value}</span>
                          : <span className="text-gray-300 italic">—</span>
                        }
                      </td>

                      {/* Source badge */}
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sourceColor(entry.source)}`}>
                          {SOURCE_LABELS[entry.source] || entry.source}
                        </span>
                      </td>

                      {/* Changed by */}
                      <td className="px-4 py-2 text-gray-500 text-xs">
                        {entry.changed_by_name || '—'}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(entry.changed_at)}
                      </td>

                    </tr>
                  ))
                )} {/* end entries map */}
              </tbody>
            </table>
          </div>
        )} {/* end change log table */}

        {/* Pagination */}
        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-white shadow rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {result.page} of {result.totalPages}
              <span className="ml-2 text-gray-400">({result.total.toLocaleString()} entries)</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(result.totalPages, p + 1))}
              disabled={page === result.totalPages}
              className="px-4 py-2 bg-white shadow rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
            >
              Next →
            </button>
          </div>
        )} {/* end pagination */}

      </div>
    </main>
  );
} // end of ChangeLogPage
