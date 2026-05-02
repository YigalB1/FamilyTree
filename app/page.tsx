'use client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { parseGedcom, GedcomData, Person } from './lib/parseGedcom';
import { buildDescendantTree, TreeNode } from './lib/buildTree';
import { pdf } from '@react-pdf/renderer';
import { TreePdf, PageFormat, Lang } from './lib/TreePdf';
import { TreeSettings, defaultSettings } from './lib/treeSettings';
import { generateAllReports } from './lib/reports/generateReports';
import Link from 'next/link';

interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role:  string;
}

export default function Home() {
  const [status, setStatus]             = useState<'idle'|'parsing'|'done'|'error'>('idle');
  const [data, setData]                 = useState<GedcomData | null>(null);
  const [rawGedcom, setRawGedcom]       = useState<string>('');
  const [currentFile, setCurrentFile]   = useState<File | null>(null);
  const [search, setSearch]             = useState('');
  const [tableSearch, setTableSearch]   = useState('');
  const [rootPerson, setRootPerson]     = useState<Person | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [tree, setTree]                 = useState<TreeNode | null>(null);
  const [pageFormat, setPageFormat]     = useState<PageFormat>('A4L');
  const [lang, setLang]                 = useState<Lang>('he');
  const [settings, setSettings]         = useState<TreeSettings>(defaultSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [generatingReports, setGeneratingReports] = useState(false);
  const [savingToDb, setSavingToDb]     = useState(false);
  const [dbSaveResult, setDbSaveResult] = useState<string | null>(null);
  const [currentUser, setCurrentUser]   = useState<AuthUser | null>(null);
  const [backingUp, setBackingUp]       = useState(false);
  const [backupResult, setBackupResult] = useState<string | null>(null);

  // ── Load current user ─────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => { if (d.user) setCurrentUser(d.user); })
      .catch(() => {});
  }, []);

  // ── Load persisted data on first render ──────────────────────
  useEffect(() => {
    try {
      const saved         = localStorage.getItem('gedcom_data');
      const savedRaw      = localStorage.getItem('gedcom_raw');
      const savedRoot     = localStorage.getItem('gedcom_root');
      const savedFormat   = localStorage.getItem('gedcom_format');
      const savedSettings = localStorage.getItem('gedcom_settings');
      if (saved) {
        const parsed: GedcomData = JSON.parse(saved);
        setData(parsed);
        setStatus('done');
        if (savedRaw)      setRawGedcom(savedRaw);
        if (savedFormat)   setPageFormat(savedFormat as PageFormat);
        if (savedSettings) setSettings(JSON.parse(savedSettings));
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

  // ── Persist whenever state changes ───────────────────────────
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
  useEffect(() => {
    localStorage.setItem('gedcom_settings', JSON.stringify(settings));
  }, [settings]);

  // ── GEDCOM file drop ──────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setStatus('parsing');
    setDbSaveResult(null);
    setCurrentFile(file);
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

  // ── Save to database ──────────────────────────────────────────
  async function saveToDatabase() {
    if (!currentFile) return;
    setSavingToDb(true);
    setDbSaveResult(null);
    try {
      const formData = new FormData();
      formData.append('file',   currentFile);
      formData.append('source', 'Geni');
      const res  = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setDbSaveResult(`❌ Error: ${data.error}`); return; }
      setDbSaveResult(
        `✅ Saved to database — ${data.personsAdded} people added, ${data.personsSkipped} already existed, ${data.familiesAdded} families added`
      );
    } catch {
      setDbSaveResult('❌ Failed to save to database');
    } finally {
      setSavingToDb(false);
    }
  }

  // ── Backup database ───────────────────────────────────────────
  async function handleBackup() {
    setBackingUp(true);
    setBackupResult(null);
    try {
      const res  = await fetch('/api/backup', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setBackupResult(`❌ Backup failed: ${data.error}`);
        return;
      }
      // Extract filename from output message
      const match = data.message?.match(/backup-[\d_-]+\.sql/);
      const filename = match ? match[0] : 'backup created';
      setBackupResult(`✅ Backup saved: ${filename}`);
    } catch {
      setBackupResult('❌ Backup failed');
    } finally {
      setBackingUp(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

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

  // ── Display name helper ───────────────────────────────────────
  function displayName(p: Person): string {
    if (lang === 'he') return `${p.firstNameHe} ${p.lastNameHe}`.trim();
    if (lang === 'en') return `${p.firstNameEn} ${p.lastNameEn}`.trim();
    return `${p.firstName} ${p.lastName}`.trim();
  }

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
    const blob = await pdf(
      <TreePdf root={tree} format={pageFormat} lang={lang} settings={settings} />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
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
    setCurrentFile(null);
    setRootPerson(null);
    setTree(null);
    setSearch('');
    setTableSearch('');
    setSettings(defaultSettings);
    setDbSaveResult(null);
    setBackupResult(null);
  }

  // ── Export to Excel ───────────────────────────────────────────
  function exportToExcel() {
    if (!rawGedcom) return;
    const lines = rawGedcom.split(/\r?\n/);
    const rows: Record<string, string>[] = [];
    let current: Record<string, string> = {};
    let lastTag1 = ''; let nameCount = 0;
    for (const line of lines) {
      const parts = line.trim().split(' ');
      const level = parseInt(parts[0]);
      if (isNaN(level)) continue;
      const tag   = parts[1];
      const value = parts.slice(2).join(' ');
      if (level === 0) {
        if (current['ID']) rows.push(current);
        current = {}; lastTag1 = ''; nameCount = 0;
        if (parts[2] === 'INDI' || parts[2] === 'FAM') {
          current['ID'] = tag.replace(/@/g, '');
          current['TYPE'] = parts[2];
        }
      } else if (level === 1) {
        lastTag1 = tag;
        if (tag === 'NAME') { nameCount++; if (value) current[`NAME_${nameCount}`] = value; }
        else { if (value) current[tag] = value; }
      } else if (level === 2) {
        if (value) current[`${lastTag1}_${tag}`] = value;
      }
    }
    if (current['ID']) rows.push(current);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'GEDCOM Raw');
    XLSX.writeFile(wb, 'gedcom-raw.xlsx');
  }

  // ── Settings updater ──────────────────────────────────────────
  function setSetting<K extends keyof TreeSettings>(key: K, value: TreeSettings[K]) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  // ── Generate reports ──────────────────────────────────────────
  async function handleGenerateReports() {
    if (!data) return;
    setGeneratingReports(true);
    try { await generateAllReports(data); }
    finally { setGeneratingReports(false); }
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">🌳 Family Tree</h1>
        {currentUser && (
          <div className="flex items-center gap-4 text-sm">
            {/* Backup button — admin only */}
            {currentUser.role === 'admin' && (
              <button
                onClick={handleBackup}
                disabled={backingUp}
                className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {backingUp ? '⏳ Backing up…' : '💾 Backup DB'}
              </button>
            )}
            <span className="opacity-80">
              {currentUser.name}
              <span className="ml-2 bg-blue-700 px-2 py-0.5 rounded-full text-xs">
                {currentUser.role}
              </span>
            </span>
            <button
              onClick={handleLogout}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-1 rounded-lg text-xs font-medium"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Backup result message */}
      {backupResult && (
        <div className={`px-8 py-2 text-sm font-medium text-center
          ${backupResult.startsWith('✅') ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {backupResult}
          <button onClick={() => setBackupResult(null)} className="ml-4 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="p-8">
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

        {/* ── Main UI ── */}
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
              {currentFile && (
                <button
                  onClick={saveToDatabase}
                  disabled={savingToDb}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 py-4 text-sm font-semibold disabled:opacity-50"
                >
                  {savingToDb ? '⏳ Saving…' : '💾 Save to Database'}
                </button>
              )}
              <button onClick={exportToExcel}
                className="bg-green-100 hover:bg-green-200 text-green-700 rounded-xl px-4 py-4 text-sm font-semibold">
                📊 Export Excel
              </button>
              <button onClick={clearAll}
                className="bg-red-100 hover:bg-red-200 text-red-700 rounded-xl px-4 py-4 text-sm font-semibold">
                🗑 Clear saved data
              </button>
              <button onClick={() => setStatus('idle')}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-4 py-4 text-sm font-semibold">
                📂 Load new file
              </button>
              <button
                onClick={handleGenerateReports}
                disabled={generatingReports}
                className="bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl px-4 py-4 text-sm font-semibold disabled:opacity-50"
              >
                {generatingReports ? '⏳ Generating...' : '📋 Generate Reports'}
              </button>
            </div>

            {/* DB save result */}
            {dbSaveResult && (
              <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium
                ${dbSaveResult.startsWith('✅')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {dbSaveResult}
              </div>
            )}

            {/* Language filter */}
            <div className="flex gap-2 mb-4 items-center">
              <span className="text-sm text-gray-500 font-medium">Show names:</span>
              {(['all', 'he', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${lang === l ? 'bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
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
                <h3 className="col-span-2 font-bold text-blue-900 text-base border-b pb-2">
                  PDF Layout Settings
                </h3>
                <label className="flex flex-col gap-1 text-gray-600">
                  Name font size ({settings.nameFontSize}pt)
                  <input type="range" min={6} max={14} value={settings.nameFontSize}
                    onChange={e => setSetting('nameFontSize', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Detail font size ({settings.detailFontSize}pt)
                  <input type="range" min={4} max={10} value={settings.detailFontSize}
                    onChange={e => setSetting('detailFontSize', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Card width ({settings.cardWidth}px)
                  <input type="range" min={80} max={200} value={settings.cardWidth}
                    onChange={e => setSetting('cardWidth', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Card height ({settings.cardHeight}px)
                  <input type="range" min={40} max={120} value={settings.cardHeight}
                    onChange={e => setSetting('cardHeight', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Vertical spacing ({settings.vGap}px)
                  <input type="range" min={20} max={120} value={settings.vGap}
                    onChange={e => setSetting('vGap', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Horizontal spacing ({settings.hGap}px)
                  <input type="range" min={10} max={80} value={settings.hGap}
                    onChange={e => setSetting('hGap', +e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Corner radius ({settings.borderRadius}px)
                  <input type="range" min={0} max={20} value={settings.borderRadius}
                    onChange={e => setSetting('borderRadius', +e.target.value)} />
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showBorder}
                    onChange={e => setSetting('showBorder', e.target.checked)} />
                  Show box border
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Border / outline color
                  <input type="color" value={settings.borderColor}
                    onChange={e => setSetting('borderColor', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer" />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Connection line color
                  <input type="color" value={settings.lineColor}
                    onChange={e => setSetting('lineColor', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer" />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Male card color
                  <input type="color" value={settings.maleColor}
                    onChange={e => setSetting('maleColor', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer" />
                </label>
                <label className="flex flex-col gap-1 text-gray-600">
                  Female card color
                  <input type="color" value={settings.femaleColor}
                    onChange={e => setSetting('femaleColor', e.target.value)}
                    className="h-8 w-16 rounded cursor-pointer" />
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showBirthPlace}
                    onChange={e => setSetting('showBirthPlace', e.target.checked)} />
                  Show birth place
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showDeathDate}
                    onChange={e => setSetting('showDeathDate', e.target.checked)} />
                  Show death date
                </label>
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" checked={settings.showMarriageDate}
                    onChange={e => setSetting('showMarriageDate', e.target.checked)} />
                  Show marriage date
                </label>
                <button onClick={() => setSettings(defaultSettings)}
                  className="col-span-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-4 py-2 font-medium mt-2">
                  ↺ Reset to defaults
                </button>
              </div>
            )}

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
                      <button key={p.id} onClick={() => selectPerson(p)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
                        <span className="font-medium">
                          {p.firstNameHe || p.firstNameEn} {p.lastNameHe || p.lastNameEn}
                        </span>
                        <span className="text-gray-400 ml-2 text-xs">{p.firstNameEn} {p.lastNameEn}</span>
                        <span className="text-gray-400 ml-2">{p.birthDate || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {rootPerson && tree && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-green-600 font-medium">
                    ✅ Tree ready for {rootPerson.firstName} {rootPerson.lastName}
                  </span>
                  <select value={pageFormat}
                    onChange={e => setPageFormat(e.target.value as PageFormat)}
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
              )}
            </div>

            {/* Table search */}
            <input type="text" placeholder="Search table by name…"
              value={tableSearch} onChange={e => setTableSearch(e.target.value)}
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
                    <tr key={p.id}
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        ${rootPerson?.id === p.id ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/person/${p.id}`} className="hover:text-blue-700 hover:underline">
                          {displayName(p)}
                        </Link>
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
            <p className="text-xs text-gray-400 mt-3 text-center">
              Showing {filtered.length} of {data.persons.length} people
            </p>

          </div>
        )}
      </div>
    </main>
  );
}
