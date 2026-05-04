'use client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { GedcomData, Person } from './lib/parseGedcom';
import { dbToGedcomData, DbPerson, DbFamily } from './lib/dbToGedcom';
import { buildDescendantTree, TreeNode } from './lib/buildTree';
import { pdf } from '@react-pdf/renderer';
import { TreePdf, PageFormat, Lang } from './lib/TreePdf';
import { TiledTreePdf, TileFormat } from './lib/TiledTreePdf';
import { TreeSettings, defaultSettings } from './lib/treeSettings';
import { generateAllReports } from './lib/reports/generateReports';

interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role:  string;
} // end of AuthUser interface

// ── Export root search ────────────────────────────────────────────

interface ExportRootSearchProps {
  persons:       Person[];
  defaultPerson: Person | null;
  onSelect:      (p: Person) => void;
} // end of ExportRootSearchProps

function ExportRootSearch({ persons, defaultPerson, onSelect }: ExportRootSearchProps) {
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState<Person | null>(defaultPerson);
  const [showDrop, setShowDrop] = useState(false);

  const suggestions = useMemo(() => {
    if (search.length < 2) return [];
    const q = search.toLowerCase();
    return persons.filter(p =>
      `${p.firstNameHe} ${p.lastNameHe}`.toLowerCase().includes(q) ||
      `${p.firstNameEn} ${p.lastNameEn}`.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [persons, search]);

  return (
    <div>
      {selected && (
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2 mb-2 border border-green-300">
          <span className="text-sm font-medium text-green-800">
            {selected.firstNameHe || selected.firstNameEn} {selected.lastNameHe || selected.lastNameEn}
          </span>
          <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs ml-2">✕</button>
        </div>
      )}
      <div className="relative">
        <input type="text" value={search}
          onChange={e => { setSearch(e.target.value); setShowDrop(true); }}
          placeholder="Search for a person…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
        {showDrop && suggestions.length > 0 && (
          <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
            {suggestions.map(p => (
              <button key={p.id} onClick={() => { setSelected(p); setSearch(''); setShowDrop(false); }}
                className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b border-gray-100 last:border-0">
                <span className="font-medium">{p.firstNameHe || p.firstNameEn} {p.lastNameHe || p.lastNameEn}</span>
                <span className="text-gray-400 ml-2 text-xs">{p.birthDate || ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => { if (selected) onSelect(selected); }} disabled={!selected}
        className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-40">
        {selected ? `Export descendants of ${selected.firstNameHe || selected.firstNameEn}` : 'Select a person first'}
      </button>
    </div>
  );
} // end of ExportRootSearch

// ── Main page ─────────────────────────────────────────────────────

export default function Home() {

  const [data, setData]                   = useState<GedcomData | null>(null);
  const [dbLoading, setDbLoading]         = useState(true);
  const [dbError, setDbError]             = useState('');
  const [search, setSearch]               = useState('');
  const [tableSearch, setTableSearch]     = useState('');
  const [rootPerson, setRootPerson]       = useState<Person | null>(null);
  const [showDropdown, setShowDropdown]   = useState(false);
  const [tree, setTree]                   = useState<TreeNode | null>(null);
  const [pageFormat, setPageFormat]       = useState<PageFormat>('A4L');
  const [tileFormat, setTileFormat]       = useState<TileFormat>('A4');
  const [lang, setLang]                   = useState<Lang>('he');
  const [settings, setSettings]           = useState<TreeSettings>(defaultSettings);
  const [showSettings, setShowSettings]   = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [generatingTiled, setGeneratingTiled]     = useState(false);
  const [currentUser, setCurrentUser]     = useState<AuthUser | null>(null);
  const [backingUp, setBackingUp]         = useState(false);
  const [backupResult, setBackupResult]   = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [importMsg, setImportMsg]         = useState<string | null>(null);
  const [importing, setImporting]         = useState(false);

  // Load user
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); }).catch(() => {});
  }, []);

  // Load from DB on mount
  useEffect(() => { loadFromDatabase(); }, []);

  async function loadFromDatabase() {
    setDbLoading(true);
    setDbError('');
    try {
      const [pr, fr] = await Promise.all([fetch('/api/persons'), fetch('/api/families')]);
      const pd = await pr.json();
      const fd = await fr.json();
      if (!pr.ok) throw new Error(pd.error);
      if (!fr.ok) throw new Error(fd.error);
      const gedcomData = dbToGedcomData(pd.persons as DbPerson[], fd.families as DbFamily[]);
      setData(gedcomData);

      // Set default root person from saved ID or first person
      if (gedcomData.persons.length > 0) {
        const savedId = localStorage.getItem('default_root_id');
        const found   = savedId ? gedcomData.persons.find(p => p.id === savedId) : null;
        const def     = found || gedcomData.persons[0];
        setRootPerson(def);
        setSearch(`${def.firstName} ${def.lastName}`);
        const t = buildDescendantTree(def.id, gedcomData);
        setTree(t);
      } // end if persons exist
    } catch (err: any) {
      setDbError(err.message || 'Failed to load from database');
    } finally {
      setDbLoading(false);
    }
  } // end of loadFromDatabase

  // GEDCOM import
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'Geni');
      const res  = await fetch('/api/import', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) { setImportMsg(`❌ Error: ${json.error}`); return; }
      setImportMsg(`✅ Imported — ${json.personsAdded} added, ${json.personsSkipped} existed, ${json.familiesAdded} families added`);
      await loadFromDatabase();
    } catch {
      setImportMsg('❌ Import failed');
    } finally {
      setImporting(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.ged', '.gedcom'] }, multiple: false,
  });

  async function handleBackup() {
    setBackingUp(true); setBackupResult(null);
    try {
      const res  = await fetch('/api/backup', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { setBackupResult(`❌ Backup failed: ${json.error}`); return; }
      const match = json.message?.match(/backup-[\d_-]+\.sql/);
      setBackupResult(`✅ Backup saved: ${match ? match[0] : 'backup created'}`);
    } catch { setBackupResult('❌ Backup failed'); }
    finally { setBackingUp(false); }
  } // end of handleBackup

  function handleExportGedcom(rootId?: string) {
    window.location.href = rootId ? `/api/export/gedcom?rootId=${rootId}` : '/api/export/gedcom';
    setShowExportModal(false);
  } // end of handleExportGedcom

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  } // end of handleLogout

  const suggestions = useMemo(() => {
    if (!data || search.length < 2) return [];
    const q = search.toLowerCase();
    return data.persons.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      `${p.firstNameEn} ${p.lastNameEn}`.toLowerCase().includes(q) ||
      `${p.firstNameHe} ${p.lastNameHe}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [data, search]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.persons.filter(p => {
      if (lang === 'he') {
        const name = `${p.firstNameHe} ${p.lastNameHe}`;
        return name.trim().length > 0 && name.toLowerCase().includes(tableSearch.toLowerCase());
      }
      if (lang === 'en') {
        const name = `${p.firstNameEn} ${p.lastNameEn}`;
        return name.trim().length > 0 && name.toLowerCase().includes(tableSearch.toLowerCase());
      }
      return `${p.firstName} ${p.lastName}`.toLowerCase().includes(tableSearch.toLowerCase());
    });
  }, [data, tableSearch, lang]);

  function displayName(p: Person): string {
    if (lang === 'he') return `${p.firstNameHe} ${p.lastNameHe}`.trim();
    if (lang === 'en') return `${p.firstNameEn} ${p.lastNameEn}`.trim();
    return `${p.firstName} ${p.lastName}`.trim();
  } // end of displayName

  function selectPerson(p: Person) {
    setRootPerson(p);
    setSearch(`${p.firstName} ${p.lastName}`);
    setShowDropdown(false);
    localStorage.setItem('default_root_id', p.id); // remember for next load
    if (data) {
      const t = buildDescendantTree(p.id, data);
      setTree(t);
    }
  } // end of selectPerson

  async function downloadPdf() {
    if (!tree || !rootPerson) return;
    const blob = await pdf(
      <TreePdf root={tree} format={pageFormat} lang={lang} settings={settings} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = `family-tree-${rootPerson.lastName}-${pageFormat}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  } // end of downloadPdf

  async function downloadTiledPdf() {
    if (!tree || !rootPerson) return;
    setGeneratingTiled(true);
    try {
      const blob = await pdf(
        <TiledTreePdf root={tree} lang={lang} settings={settings} tileFormat={tileFormat} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url; a.download = `family-tree-${rootPerson.lastName}-tiled-${tileFormat}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } finally {
      setGeneratingTiled(false);
    }
  } // end of downloadTiledPdf

  function setSetting<K extends keyof TreeSettings>(key: K, value: TreeSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
  } // end of setSetting

  async function handleGenerateReports() {
    if (!data) return;
    setGeneratingReports(true);
    try { await generateAllReports(data); }
    finally { setGeneratingReports(false); }
  } // end of handleGenerateReports

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">🌳 Family Tree</h1>
        {currentUser && (
          <div className="flex items-center gap-3 text-sm">
            {currentUser.role === 'admin' && (
              <button onClick={handleBackup} disabled={backingUp}
                className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50">
                {backingUp ? '⏳ Backing up…' : '💾 Backup DB'}
              </button>
            )}
            <div {...getRootProps()}>
              <input {...getInputProps()} />
              <button className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">
                {importing ? '⏳ Importing…' : '📥 Import GEDCOM'}
              </button>
            </div>
            {currentUser.role !== 'viewer' && (
              <button onClick={() => setShowExportModal(true)}
                className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">
                📤 Export GEDCOM
              </button>
            )}
            <Link href="/changelog" className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">📋 Change Log</Link>
            <Link href="/quality"   className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">🔍 Data Quality</Link>
            {currentUser.role === 'admin' && (
              <Link href="/admin/users"  className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">👥 Users</Link>
            )}
            {currentUser.role === 'admin' && (
              <Link href="/admin/photos" className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">📸 Photos</Link>
            )}
            <span className="opacity-80">
              {currentUser.name}
              <span className="ml-2 bg-blue-700 px-2 py-0.5 rounded-full text-xs">{currentUser.role}</span>
            </span>
            <button onClick={handleLogout} className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium">Sign out</button>
          </div>
        )}
      </div>

      {backupResult && (
        <div className={`px-8 py-2 text-sm font-medium text-center ${backupResult.startsWith('✅') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {backupResult}
          <button onClick={() => setBackupResult(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {importMsg && (
        <div className={`px-8 py-2 text-sm font-medium text-center ${importMsg.startsWith('✅') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {importMsg}
          <button onClick={() => setImportMsg(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="p-8">

        {dbLoading && (
          <div className="text-center py-20">
            <p className="text-blue-600 animate-pulse text-lg">Loading family data…</p>
          </div>
        )}

        {dbError && !dbLoading && (
          <div className="max-w-lg mx-auto bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <p className="text-red-600 font-medium mb-2">Failed to load database</p>
            <p className="text-red-400 text-sm mb-4">{dbError}</p>
            <button onClick={loadFromDatabase} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-medium">Retry</button>
          </div>
        )}

        {!dbLoading && !dbError && data && data.persons.length === 0 && (
          <div className="max-w-lg mx-auto border-2 border-dashed rounded-2xl p-12 text-center border-gray-300 bg-white">
            <div className="text-5xl mb-4">🌳</div>
            <p className="text-lg font-semibold text-gray-700 mb-2">No data in database yet</p>
            <p className="text-sm text-gray-400 mb-6">Click <strong>📥 Import GEDCOM</strong> in the top bar</p>
            <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-8 cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
              <input {...getInputProps()} />
              <p className="text-sm text-gray-500">Or drag & drop a .ged file here</p>
            </div>
          </div>
        )}

        {!dbLoading && !dbError && data && data.persons.length > 0 && (
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
              <button onClick={loadFromDatabase} className="bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl px-4 py-4 text-sm font-semibold">🔄 Refresh</button>
              <button onClick={handleGenerateReports} disabled={generatingReports}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl px-4 py-4 text-sm font-semibold disabled:opacity-50">
                {generatingReports ? '⏳ Generating...' : '📋 Generate Reports'}
              </button>
            </div>

            {/* Language */}
            <div className="flex gap-2 mb-4 items-center">
              <span className="text-sm text-gray-500 font-medium">Show names:</span>
              {(['all', 'he', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${lang === l ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                  {l === 'all' ? '🌐 All' : l === 'he' ? '🇮🇱 Hebrew' : '🇬🇧 English'}
                </button>
              ))}
            </div>

            {/* Settings toggle */}
            <div className="mb-4">
              <button onClick={() => setShowSettings(s => !s)}
                className="bg-white shadow rounded-xl px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50">
                ⚙️ {showSettings ? 'Hide' : 'Show'} PDF Layout Settings
              </button>
            </div>

            {/* Settings panel */}
            {showSettings && (
              <div className="bg-white rounded-2xl shadow p-6 mb-6 grid grid-cols-2 gap-5 text-sm">
                <h3 className="col-span-2 font-bold text-blue-900 text-base border-b pb-2">PDF Layout Settings</h3>
                {[
                  ['Name font size', 'nameFontSize', 6, 14],
                  ['Detail font size', 'detailFontSize', 4, 10],
                  ['Card width', 'cardWidth', 80, 200],
                  ['Card height', 'cardHeight', 40, 120],
                  ['Vertical spacing', 'vGap', 20, 120],
                  ['Horizontal spacing', 'hGap', 10, 80],
                  ['Corner radius', 'borderRadius', 0, 20],
                ].map(([label, key, min, max]) => (
                  <label key={key as string} className="flex flex-col gap-1 text-gray-600">
                    {label} ({(settings as any)[key as string]}pt)
                    <input type="range" min={min as number} max={max as number} value={(settings as any)[key as string]}
                      onChange={e => setSetting(key as keyof TreeSettings, +e.target.value)} />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showBorder} onChange={e => setSetting('showBorder', e.target.checked)} />
                  Show box border
                </label>
                {[
                  ['Border color', 'borderColor'], ['Line color', 'lineColor'],
                  ['Male card color', 'maleColor'], ['Female card color', 'femaleColor'],
                ].map(([label, key]) => (
                  <label key={key} className="flex flex-col gap-1 text-gray-600">
                    {label}
                    <input type="color" value={(settings as any)[key]}
                      onChange={e => setSetting(key as keyof TreeSettings, e.target.value)}
                      className="h-8 w-16 rounded cursor-pointer" />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showBirthPlace} onChange={e => setSetting('showBirthPlace', e.target.checked)} />
                  Show birth place
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showDeathDate} onChange={e => setSetting('showDeathDate', e.target.checked)} />
                  Show death date
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showMarriageDate} onChange={e => setSetting('showMarriageDate', e.target.checked)} />
                  Show marriage date
                </label>
                <button onClick={() => setSettings(defaultSettings)} className="col-span-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium mt-2">↺ Reset to defaults</button>
              </div>
            )}

            {/* Root person + PDF controls */}
            <div className="bg-white rounded-2xl shadow p-6 mb-6">
              <h2 className="text-lg font-bold text-blue-900 mb-3">Select root person for tree</h2>
              <div className="relative">
                <input type="text" placeholder="Type a name to search…" value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true); setRootPerson(null); setTree(null); }}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {showDropdown && suggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                    {suggestions.map(p => (
                      <button key={p.id} onClick={() => selectPerson(p)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
                        <span className="font-medium">{p.firstNameHe || p.firstNameEn} {p.lastNameHe || p.lastNameEn}</span>
                        <span className="text-gray-400 ml-2 text-xs">{p.firstNameEn} {p.lastNameEn}</span>
                        <span className="text-gray-400 ml-2">{p.birthDate || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {rootPerson && tree && (
                <div className="mt-4 space-y-3">

                  {/* Single page PDF */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-green-600 font-medium">
                      ✅ Tree ready for {rootPerson.firstName} {rootPerson.lastName}
                    </span>
                    <select value={pageFormat} onChange={e => setPageFormat(e.target.value as PageFormat)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="A4L">A4 Landscape</option>
                      <option value="A3L">A3 Landscape</option>
                      <option value="A1L">A1 (Plotter)</option>
                      <option value="A0L">A0 (Plotter)</option>
                    </select>
                    <button onClick={downloadPdf}
                      className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
                      ⬇ Download PDF
                    </button>
                  </div>

                  {/* Tiled print */}
                  <div className="flex items-center gap-3 flex-wrap bg-amber-50 rounded-xl px-4 py-3 border border-amber-200">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">🖨️ Tiled Print</p>
                      <p className="text-xs text-amber-600">
                        Split tree across multiple pages for home printing and assembly.
                      </p>
                    </div>
                    <select value={tileFormat} onChange={e => setTileFormat(e.target.value as TileFormat)}
                      className="border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="A4">A4 tiles</option>
                      <option value="A3">A3 tiles</option>
                    </select>
                    <button onClick={downloadTiledPdf} disabled={generatingTiled}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-5 py-2 rounded-xl text-sm disabled:opacity-50 whitespace-nowrap">
                      {generatingTiled ? '⏳ Generating…' : '🖨️ Download Tiled PDF'}
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Table search */}
            <input type="text" placeholder="Search table by name…" value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />

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
                    <tr key={p.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${rootPerson?.id === p.id ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/person/${p.id}`} className="hover:text-blue-700 hover:underline">{displayName(p)}</Link>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{p.sex === 'M' ? '♂' : p.sex === 'F' ? '♀' : '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{p.birthDate || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{p.birthPlace || '—'}</td>
                      <td className="px-4 py-2 text-gray-500">{p.deathDate || '—'}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => selectPerson(p)}
                          className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-lg">
                          Set as root
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">Showing {filtered.length} of {data.persons.length} people</p>

          </div>
        )}

      </div>

      {/* Export modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-blue-900 mb-2">📤 Export GEDCOM</h2>
            <p className="text-gray-500 text-sm mb-6">Choose what to export from the database.</p>
            <div className="space-y-3 mb-6">
              <button onClick={() => handleExportGedcom()}
                className="w-full bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl p-4 text-left">
                <p className="font-semibold text-blue-900">🌳 Export entire tree</p>
                <p className="text-sm text-gray-500 mt-1">All people and families in the database</p>
              </button>
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="font-semibold text-green-800 mb-3">👤 Export descendants of…</p>
                <ExportRootSearch
                  persons={data?.persons || []}
                  defaultPerson={rootPerson}
                  onSelect={p => handleExportGedcom(p.id)}
                />
              </div>
            </div>
            <button onClick={() => setShowExportModal(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

    </main>
  );
} // end of Home
