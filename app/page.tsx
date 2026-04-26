'use client';
import { useCallback, useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { parseGedcom, GedcomData, Person } from './lib/parseGedcom';
import { buildDescendantTree, TreeNode } from './lib/buildTree';
import { pdf } from '@react-pdf/renderer';
import { TreePdf, PageFormat } from './lib/TreePdf';


export default function Home() {
  const [status, setStatus]             = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [data, setData]                 = useState<GedcomData | null>(null);
  const [search, setSearch]             = useState('');
  const [tableSearch, setTableSearch]   = useState('');
  const [rootPerson, setRootPerson]     = useState<Person | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tree, setTree]                 = useState<TreeNode | null>(null);
  const [pageFormat, setPageFormat] = useState<'A4L'|'A3L'|'A1L'|'A0L'>('A4L');

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
      } catch { setStatus('error'); }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.ged', '.gedcom'] }, multiple: false,
  });

  const suggestions = useMemo(() => {
    if (!data || search.length < 2) return [];
    return data.persons
      .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 8);
  }, [data, search]);

  const filtered = data?.persons.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(tableSearch.toLowerCase())
  ) || [];

  function selectPerson(p: Person) {
    setRootPerson(p);
    setSearch(`${p.firstName} ${p.lastName}`);
    setShowDropdown(false);
    if (data) {
      const t = buildDescendantTree(p.id, data);
      setTree(t);
    }
  }

  async function downloadPdf() {
  if (!tree || !rootPerson) return;
  const blob = await pdf(<TreePdf root={tree} format={pageFormat} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `family-tree-${rootPerson.lastName}-${pageFormat}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
  



  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-blue-900 mb-2 text-center">Family Tree</h1>
      <p className="text-gray-500 mb-8 text-center">Import your family data to get started</p>

      {(status === 'idle' || status === 'error') && (
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
          {status === 'error' && (
            <p className="mt-4 text-red-500 text-sm">Something went wrong. Please try again.</p>
          )}
        </div>
      )}

      {status === 'parsing' && (
        <p className="text-center text-blue-600 animate-pulse mt-12">Parsing your file…</p>
      )}

      {status === 'done' && data && (
        <div className="max-w-4xl mx-auto">

          {/* Summary */}
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
              onClick={() => { setStatus('idle'); setData(null); setRootPerson(null); setTree(null); setSearch(''); }}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-6 py-4 text-sm font-semibold"
            >
              Load another file
            </button>
          </div>

          {/* Root person selector */}
          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-blue-900 mb-3">Select root person for tree</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Type a name to search…"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setShowDropdown(true);
                  setRootPerson(null);
                  setTree(null);
                }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {showDropdown && suggestions.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {suggestions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => selectPerson(p)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
                    >
                      <span className="font-medium">{p.firstName} {p.lastName}</span>
                      <span className="text-gray-400 ml-2">{p.birthDate || ''} {p.birthPlace || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {rootPerson && tree && (
              <div className="mt-4 flex items-center gap-3">
                <span className="text-sm text-green-600 font-medium">
                  ✅ Tree ready for {rootPerson.firstName} {rootPerson.lastName}
                </span>
                <button
                  onClick={downloadPdf}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  ⬇ Download PDF
                </button>
              </div>
            )}
          </div>

          {/* Search table */}
          <input
            type="text"
            placeholder="Search table by name…"
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* People table */}
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Sex</th>
                  <th className="text-left px-4 py-3">Born</th>
                  <th className="text-left px-4 py-3">Birthplace</th>
                  <th className="text-left px-4 py-3">Died</th>
                  <th className="text-left px-4 py-3">Select</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${rootPerson?.id === p.id ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium">{p.firstName} {p.lastName}</td>
                    <td className="px-4 py-2 text-gray-500">{p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.birthDate || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.birthPlace || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{p.deathDate || '—'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => selectPerson(p)}
                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-lg"
                      >
                        Set as root
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Showing {filtered.length} of {data.persons.length} people
          </p>

        </div>
      )}
    </main>
  );
}