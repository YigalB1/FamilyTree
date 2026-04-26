'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseGedcom, GedcomData } from './lib/parseGedcom';

export default function Home() {
  const [status, setStatus]   = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [data, setData]       = useState<GedcomData | null>(null);
  const [search, setSearch]   = useState('');

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setStatus('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseGedcom(text);
        setData(parsed);
        setStatus('done');
      } catch {
        setStatus('error');
      }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.ged', '.gedcom'] },
    multiple: false,
  });

  const filtered = data?.persons.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-blue-900 mb-2 text-center">Family Tree</h1>
      <p className="text-gray-500 mb-8 text-center">Import your family data to get started</p>

      {/* Drop zone */}
      {status === 'idle' || status === 'error' ? (
        <div
          {...getRootProps()}
          className={`max-w-lg mx-auto border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400'}`}
        >
          <input {...getInputProps()} />
          <div className="text-5xl mb-4">🌳</div>
          <p className="text-lg font-semibold text-gray-700 mb-2">Import GEDCOM from Geni</p>
          <p className="text-sm text-gray-400 mb-6">Drag & drop your .ged file, or click to browse</p>
          <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl">
            Choose GEDCOM File
          </button>
          {status === 'error' && <p className="mt-4 text-red-500 text-sm">Something went wrong. Please try again.</p>}
        </div>
      ) : null}

      {status === 'parsing' && (
        <p className="text-center text-blue-600 animate-pulse mt-12">Parsing your file…</p>
      )}

      {/* Results */}
      {status === 'done' && data && (
        <div className="max-w-4xl mx-auto">
          {/* Summary bar */}
          <div className="flex gap-4 mb-6">
            <div className="bg-blue-700 text-white rounded-xl px-6 py-4 flex-1 text-center">
              <p className="text-3xl font-bold">{data.persons.length}</p>
              <p className="text-sm opacity-80">People</p>
            </div>
            <div className="bg-green-600 text-white rounded-xl px-6 py-4 flex-1 text-center">
              <p className="text-3xl font-bold">{data.families.length}</p>
              <p className="text-sm opacity-80">Families</p>
            </div>
            <button
              onClick={() => { setStatus('idle'); setData(null); setSearch(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-6 py-4 text-sm font-semibold"
            >
              Load another file
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* People list */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Sex</th>
                  <th className="text-left px-4 py-3">Born</th>
                  <th className="text-left px-4 py-3">Birthplace</th>
                  <th className="text-left px-4 py-3">Died</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium">{p.firstName} {p.lastName}</td>
                    <td className="px-4 py-2 text-gray-500">{p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.birthDate || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.birthPlace || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.deathDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Showing {filtered.length} of {data.persons.length} people</p>
        </div>
      )}
    </main>
  );
}