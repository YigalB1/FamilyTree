'use client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { parseGedcom, GedcomData, Person } from './lib/parseGedcom';
import { buildDescendantTree, TreeNode } from './lib/buildTree';
import { pdf } from '@react-pdf/renderer';
import { TreePdf, PageFormat } from './lib/TreePdf';

export default function Home() {
  const [status, setStatus]             = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [data, setData]                 = useState<GedcomData | null>(null);
  const [rawGedcom, setRawGedcom]       = useState<string>('');
  const [search, setSearch]             = useState('');
  const [tableSearch, setTableSearch]   = useState('');
  const [rootPerson, setRootPerson]     = useState<Person | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tree, setTree]                 = useState<TreeNode | null>(null);
  const [pageFormat, setPageFormat]     = useState<PageFormat>('A4L');
  const [lang, setLang]                 = useState<'all'|'he'|'en'>('he');

  // ── Load persisted data on first render ──────────────────────
  useEffect(() => {
    try {
      const saved       = localStorage.getItem('gedcom_data');
      const savedRaw    = localStorage.getItem('gedcom_raw');
      const savedRoot   = localStorage.getItem('gedcom_root');
      const savedFormat = localStorage.getItem('gedcom_format');
      if (saved) {
        const parsed: GedcomData = JSON.parse(saved);
        setData(parsed);
        setStatus('done');
        if (savedRaw)    setRawGedcom(savedRaw);
        if (savedFormat) setPageFormat(savedFormat as PageFormat);
        if (savedRoot) {
          const person: Person = JSON.parse(savedRoot);
          setRootPerson(person);
          setSearch(`${person.firstName} ${person.lastName}`);
          const t = buildDescendantTree(person.id, parsed);
          setTree(t);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Persist whenever data/raw/root/format changes ─────────────
  useEffect(() => {
    if (data) localStorage.setItem('gedcom_data', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (rawGedcom) localStorage.setItem('gedcom_raw', rawGedcom);
  }, [rawGedcom]);

  useEffect(() => {
    if (rootPerson) localStorage.setItem('gedcom_root', JSON.stringify(rootPerson));
  }, [rootPerson]);

  useEffect(() => {
    localStorage.setItem('gedcom_format', pageFormat);
  }, [pageFormat]);

  // ── GEDCOM file drop ──────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setStatus('parsing');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setRawGedcom(text);
        const parsed = parseGedcom(text);
        setData(parsed);
        setStatus('done');
        setRootPerson(null);
        setTree(null);
        setSearch('');
      } catch { setStatus('error'); }
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.ged', '.gedcom'] }, multiple: false,
  });

  // ── Search dropdown suggestions ───────────────────────────────
  const suggestions = useMemo(() => {
    if (!data || search.length < 2) return [];
    const q = search.toLowerCase();
    return data.persons
      .filter(p =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        `${p.firstNameEn} ${p.lastNameEn}`.toLowerCase().includes(q) ||
        `${p.firstNameHe} ${p.lastNameHe}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [data, search]);

  // ── Table filter with language ────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.persons.filter(p => {
      if (lang === 'he') {
        const name = `${p.firstNameHe} ${p.lastNameHe}`;
        return name.trim().length > 0 &&
          name.toLowerCase().includes(tableSearch.toLowerCase());
      }
      if (lang === 'en') {
        const name = `${p.firstNameEn} ${p.lastNameEn}`;
        return name.trim().length > 0 &&
          name.toLowerCase().includes(tableSearch.toLowerCase());
      }
      const name = `${p.firstName} ${p.lastName}`;
      return name.toLowerCase().includes(tableSearch.toLowerCase());
    });
  }, [data, tableSearch, lang]);

  // ── Select root person ────────────────────────────────────────
  function selectPerson(p: Person) {
    setRootPerson(p);
    setSearch(`${p.firstName} ${p.lastName}`);
    setShowDropdown(false);
    if (data) {
      const t = buildDescendantTree(p.id, data);
      setTree(t);
    }
  }

  // ── Download PDF ──────────────────────────────────────────────
  async function downloadPdf() {
    if (!tree || !rootPerson) return;
    const blob = await pdf(<TreePdf root={tree} format={pageFormat} lang={lang} />).toBlob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `family-tree-${rootPerson.lastName}-${pageFormat}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Clear everything ──────────────────────────────────────────
  function clearAll() {
    localStorage.clear();
    setStatus('idle');
    setData(null);
    setRawGedcom('');
    setRootPerson(null);
    setTree(null);
    setSearch('');
    setTableSearch('');
  }

  // ── Export to Excel ───────────────────────────────────────────
  function exportToExcel() {
    if (!rawGedcom) return;

    const lines = rawGedcom.split(/\r?\n/);
    const rows: Record<string, string>[] = [];
    let current: Record<string, string> = {};
    let lastTag1 = '';
    let nameCount = 0;

    for (const line of lines) {
      const parts = line.trim().split(' ');
      const level = parseInt(parts[0]);
      if (isNaN(level)) continue;
      const tag   = parts[1];
      const value = parts.slice(2).join(' ');

      if (level === 0) {
        if (current['ID']) rows.push(current);
        current   = {};
        lastTag1  = '';
        nameCount = 0;
        if (parts[2] === 'INDI' || parts[2] === 'FAM') {
          current['ID']   = tag.replace(/@/g, '');
          current['TYPE'] = parts[2];
        }
      } else if (level === 1) {
        lastTag1 = tag;
        if (tag === 'NAME') {
          nameCount++;
          const key = nameCount === 1 ? 'NAME_1' : `NAME_${nameCount}`;
          if (value) current[key] = value;
        } else {
          if (value) current[tag] = value;
        }
      } else if (level === 2) {
        const key = `${lastTag1}_${tag}`;
        if (value) current[key] = value;
      }
    }
    if (current['ID']) rows.push(current);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'GEDCOM Raw');
    XLSX.writeFile(wb, 'gedcom-raw.xlsx');
  }

  // ── Display name helper ───────────────────────────────────────
  function displayName(p: Person): string {
    if (lang === 'he') return `${p.firstNameHe} ${p.lastNameHe}`.trim();
    if (lang === 'en') return `${p.firstNameEn} ${p.lastNameEn}`.trim();
    return `${p.firstName} ${p.lastName}`.trim();
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-4xl font-bold text-blue-900 mb-2 text-center">🌳 Family Tree</h1>
      <p className="text-gray-500 mb-8 text-center">Import your family data to get started</p>

      {/* ── Drop zone ── */}
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

      {/* ── Main UI after file loaded ── */}
      {status === 'done' && data && (
        <div className="max-w-4xl mx-auto">

          {/* Summary bar */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="bg-blue-700 text-white rounded-xl px-6 py-4 flex-1 text-center">
              <p className="text-3xl font-bold">{data.persons.length}</p>
              <p className="text-sm opacity-80">People</p>
            </div>
            <div className="bg-green-600 text-white rounded-xl px-6 py-4 flex-1 text-center">
              <p className="text-3xl font-bold">{data.families.length}</p>
              <p className="text-sm opacity-80">Families</p>
            </div>
            <button
              onClick={exportToExcel}
              className="bg-green-100 hover:bg-green-200 text-green-700 rounded-xl px-4 py-4 text-sm font-semibold"
            >
              📊 Export Excel
            </button>
            <button
              onClick={clearAll}
              className="bg-red-100 hover:bg-red-200 text-red-700 rounded-xl px-4 py-4 text-sm font-semibold"
            >
              🗑 Clear saved data
            </button>
            <button
              onClick={() => setStatus('idle')}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-4 py-4 text-sm font-semibold"
            >
              📂 Load new file
            </button>
          </div>

          {/* Language filter */}
          <div className="flex gap-2 mb-4 items-center">
            <span className="text-sm text-gray-500 font-medium">Show names:</span>
            {(['all', 'he', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${lang === l ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                {l === 'all' ? '🌐 All' : l === 'he' ? '🇮🇱 Hebrew' : '🇬🇧 English'}
              </button>
            ))}
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
                      <span className="font-medium">{p.firstNameHe || p.firstNameEn} {p.lastNameHe || p.lastNameEn}</span>
                      <span className="text-gray-400 ml-2 text-xs">{p.firstNameEn} {p.lastNameEn}</span>
                      <span className="text-gray-400 ml-2">{p.birthDate || ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PDF controls */}
            {rootPerson && tree && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-green-600 font-medium">
                  ✅ Tree ready for {rootPerson.firstName} {rootPerson.lastName}
                </span>
                <select
                  value={pageFormat}
                  onChange={e => setPageFormat(e.target.value as PageFormat)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="A4L">A4 Landscape</option>
                  <option value="A3L">A3 Landscape</option>
                  <option value="A1L">A1 (Plotter)</option>
                  <option value="A0L">A0 (Plotter)</option>
                </select>
                <button
                  onClick={downloadPdf}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  ⬇ Download PDF
                </button>
              </div>
            )}
          </div>

          {/* Table search */}
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
                    className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      ${rootPerson?.id === p.id ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                  >
                    <td className="px-4 py-2 font-medium">{displayName(p)}</td>
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