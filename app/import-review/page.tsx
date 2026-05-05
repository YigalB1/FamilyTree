'use client';
import { useState, useCallback } from 'react';
import { useDropzone }           from 'react-dropzone';
import Link                      from 'next/link';

interface FieldChange {
  field:          string;
  label:          string;
  existingValue:  string;
  newValue:       string;
  manuallyEdited: boolean;
} // end of FieldChange interface

interface PersonComparison {
  geniId:       string;
  status:       'new' | 'changed';
  gedcomPerson: {
    firstName: string; lastName: string;
    firstNameHe: string; lastNameHe: string;
    birthDate: string;
  };
  dbPerson:  any;
  changes:   FieldChange[];
} // end of PersonComparison interface

interface CompareResult {
  filename:       string;
  newPersons:     PersonComparison[];
  changedPersons: PersonComparison[];
  identicalCount: number;
  totalInGedcom:  number;
  totalInDb:      number;
} // end of CompareResult interface

type FieldResolution = 'keep' | 'update';
type PersonAction    = 'add' | 'skip' | 'update' | 'applied';

export default function ImportReviewPage() {
  const [step,        setStep]        = useState<'upload' | 'reviewing' | 'done'>('upload');
  const [comparing,   setComparing]   = useState(false);
  const [applying,    setApplying]    = useState(false);
  const [result,      setResult]      = useState<CompareResult | null>(null);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [error,       setError]       = useState('');
  const [applyResult, setApplyResult] = useState<any>(null);

  // Track per-person applying state
  const [applyingPerson, setApplyingPerson] = useState<string | null>(null);

  const [personActions,    setPersonActions]    = useState<Record<string, PersonAction>>({});
  const [fieldResolutions, setFieldResolutions] = useState<Record<string, Record<string, FieldResolution>>>({});

  // ── File drop ──────────────────────────────────────────────────
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setCurrentFile(file);
    setComparing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res  = await fetch('/api/import/compare', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setResult(data);

      const actions: Record<string, PersonAction> = {};
      const resolutions: Record<string, Record<string, FieldResolution>> = {};

      for (const p of data.newPersons) {
        actions[p.geniId] = 'add';
      } // end for new
      for (const p of data.changedPersons) {
        actions[p.geniId] = 'update';
        resolutions[p.geniId] = {};
        for (const change of p.changes) {
          resolutions[p.geniId][change.field] = change.manuallyEdited ? 'keep' : 'update';
        } // end for changes
      } // end for changed

      setPersonActions(actions);
      setFieldResolutions(resolutions);
      setStep('reviewing');
    } catch {
      setError('Comparison failed. Please try again.');
    } finally {
      setComparing(false);
    }
  }, []); // end of onDrop

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'text/plain': ['.ged', '.gedcom'] }, multiple: false,
  });

  // ── Apply a single person ──────────────────────────────────────
  async function applyOnePerson(p: PersonComparison) {
    if (!currentFile) return;
    setApplyingPerson(p.geniId);
    try {
      const resolution = {
        geniId: p.geniId,
        action: personActions[p.geniId] === 'skip' ? 'skip' :
                p.status === 'new' ? 'add' : 'update',
        fields: fieldResolutions[p.geniId] || {},
      };

      const formData = new FormData();
      formData.append('file',        currentFile);
      formData.append('resolutions', JSON.stringify([resolution]));
      formData.append('source',      'Geni');

      const res  = await fetch('/api/import/apply', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      // Mark this person as applied
      setPersonActions(a => ({ ...a, [p.geniId]: 'applied' }));
    } catch {
      setError(`Failed to apply ${personDisplayName(p)}`);
    } finally {
      setApplyingPerson(null);
    }
  } // end of applyOnePerson

  // ── Apply all remaining ────────────────────────────────────────
  async function handleApplyAll() {
    if (!currentFile || !result) return;
    setApplying(true);
    setError('');
    try {
      // Only include people not already individually applied
      const resolutions = [
        ...result.newPersons
          .filter(p => personActions[p.geniId] !== 'applied')
          .map(p => ({
            geniId: p.geniId,
            action: personActions[p.geniId] || 'skip',
          })),
        ...result.changedPersons
          .filter(p => personActions[p.geniId] !== 'applied')
          .map(p => ({
            geniId: p.geniId,
            action: personActions[p.geniId] || 'skip',
            fields: fieldResolutions[p.geniId] || {},
          })),
      ];

      const formData = new FormData();
      formData.append('file',        currentFile);
      formData.append('resolutions', JSON.stringify(resolutions));
      formData.append('source',      'Geni');

      const res  = await fetch('/api/import/apply', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }

      setApplyResult(data);
      setStep('done');
    } catch {
      setError('Apply failed. Please try again.');
    } finally {
      setApplying(false);
    }
  } // end of handleApplyAll

  // ── Helpers ────────────────────────────────────────────────────
  function personDisplayName(p: PersonComparison) {
    const he = `${p.gedcomPerson.firstNameHe || ''} ${p.gedcomPerson.lastNameHe || ''}`.trim();
    const en = `${p.gedcomPerson.firstName   || ''} ${p.gedcomPerson.lastName   || ''}`.trim();
    const name = he || en || p.geniId;
    const dob  = p.gedcomPerson.birthDate ? ` · b. ${p.gedcomPerson.birthDate}` : '';
    return { name, dob };
  } // end of personDisplayName

  const addCount     = result ? result.newPersons.filter(p => personActions[p.geniId] === 'add').length : 0;
  const updateCount  = result ? result.changedPersons.filter(p => personActions[p.geniId] === 'update').length : 0;
  const appliedCount = result ? [
    ...result.newPersons, ...result.changedPersons
  ].filter(p => personActions[p.geniId] === 'applied').length : 0;
  const skipCount    = result ? (
    result.newPersons.filter(p => personActions[p.geniId] === 'skip').length +
    result.changedPersons.filter(p => personActions[p.geniId] === 'skip').length
  ) : 0;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">📥 Import & Compare GEDCOM</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-5xl mx-auto p-8">

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="bg-white rounded-2xl shadow p-8 mb-6">
            <h2 className="text-xl font-bold text-blue-900 mb-2">Compare new GEDCOM with your tree</h2>
            <p className="text-gray-500 text-sm mb-6">
              Upload a GEDCOM file to see what has changed since your last import.
              New people, changed fields, and conflicts will be shown before anything is saved.
              <strong className="text-blue-700"> Nothing changes until you apply.</strong>
            </p>
            <div {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
              <input {...getInputProps()} />
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-600 font-medium mb-1">Drag & drop your GEDCOM file here</p>
              <p className="text-gray-400 text-sm">or click to browse (.ged / .gedcom)</p>
            </div>
            {comparing && <p className="text-center text-blue-600 animate-pulse mt-6">Comparing with database…</p>}
            {error && <p className="text-center text-red-500 mt-4">{error}</p>}
          </div>
        )} {/* end step upload */}

        {/* ── Step 2: Review ── */}
        {step === 'reviewing' && result && (
          <div>

            {/* Summary */}
            <div className="grid grid-cols-5 gap-3 mb-6">
              <div className="bg-white rounded-xl shadow p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{result.totalInGedcom}</p>
                <p className="text-xs text-gray-500">In GEDCOM</p>
              </div>
              <div className="bg-green-50 rounded-xl shadow p-4 text-center border border-green-200">
                <p className="text-2xl font-bold text-green-600">{result.newPersons.length}</p>
                <p className="text-xs text-green-600">New people</p>
              </div>
              <div className="bg-amber-50 rounded-xl shadow p-4 text-center border border-amber-200">
                <p className="text-2xl font-bold text-amber-600">{result.changedPersons.length}</p>
                <p className="text-xs text-amber-600">Changed</p>
              </div>
              <div className="bg-blue-50 rounded-xl shadow p-4 text-center border border-blue-200">
                <p className="text-2xl font-bold text-blue-600">{appliedCount}</p>
                <p className="text-xs text-blue-600">Applied so far</p>
              </div>
              <div className="bg-gray-50 rounded-xl shadow p-4 text-center border border-gray-200">
                <p className="text-2xl font-bold text-gray-500">{result.identicalCount}</p>
                <p className="text-xs text-gray-500">Identical</p>
              </div>
            </div>

            {/* Apply bar */}
            <div className="bg-blue-900 text-white rounded-2xl p-4 mb-4 flex items-center justify-between">
              <div className="text-sm flex gap-4">
                <span>✅ Adding: <strong>{addCount}</strong></span>
                <span>✏️ Updating: <strong>{updateCount}</strong></span>
                <span>✔ Applied: <strong>{appliedCount}</strong></span>
                <span>⏭ Skipping: <strong>{skipCount}</strong></span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('upload')}
                  className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm">
                  ← Different file
                </button>
                <button
                  onClick={handleApplyAll}
                  disabled={applying || (addCount === 0 && updateCount === 0)}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 px-6 py-2 rounded-lg text-sm font-bold">
                  {applying ? '⏳ Applying…' : '✅ Apply All Remaining'}
                </button>
              </div>
            </div>

            {/* Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-800">
              ℹ️ <strong>Nothing is saved until applied.</strong> You can apply each person individually, or press <strong>Apply All Remaining</strong> when done reviewing.
            </div>

            {error && <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-xl px-4 py-2">{error}</p>}

            {/* ── New people ── */}
            {result.newPersons.length > 0 && (
              <div className="bg-white rounded-2xl shadow mb-6 overflow-hidden">
                <div className="bg-green-600 text-white px-6 py-3 flex items-center justify-between">
                  <h3 className="font-bold">New People ({result.newPersons.length})</h3>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => {
                      const a = { ...personActions };
                      result.newPersons.forEach(p => { if (a[p.geniId] !== 'applied') a[p.geniId] = 'add'; });
                      setPersonActions(a);
                    }} className="bg-green-500 hover:bg-green-400 px-3 py-1 rounded-lg">Add all</button>
                    <button onClick={() => {
                      const a = { ...personActions };
                      result.newPersons.forEach(p => { if (a[p.geniId] !== 'applied') a[p.geniId] = 'skip'; });
                      setPersonActions(a);
                    }} className="bg-green-700 hover:bg-green-600 px-3 py-1 rounded-lg">Skip all</button>
                  </div>
                </div>
                <div className="divide-y">
                  {result.newPersons.map(p => {
                    const { name, dob } = personDisplayName(p);
                    const isApplied = personActions[p.geniId] === 'applied';
                    return (
                      <div key={p.geniId}
                        className={`px-6 py-3 flex items-center justify-between
                          ${isApplied ? 'bg-green-50 opacity-60' : ''}`}>
                        <div>
                          <span className="font-medium text-sm">{name}</span>
                          <span className="text-gray-400 text-xs ml-2">{dob}</span>
                          {isApplied && <span className="ml-2 text-xs text-green-600 font-medium">✔ Applied</span>}
                        </div>
                        {!isApplied && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPersonActions(a => ({ ...a, [p.geniId]: 'add' }))}
                              className={`px-3 py-1 rounded-lg text-xs font-medium
                                ${personActions[p.geniId] === 'add'
                                  ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              Add
                            </button>
                            <button
                              onClick={() => setPersonActions(a => ({ ...a, [p.geniId]: 'skip' }))}
                              className={`px-3 py-1 rounded-lg text-xs font-medium
                                ${personActions[p.geniId] === 'skip'
                                  ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              Skip
                            </button>
                            <button
                              onClick={() => applyOnePerson(p)}
                              disabled={applyingPerson === p.geniId || personActions[p.geniId] === 'skip'}
                              className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40">
                              {applyingPerson === p.geniId ? '⏳' : '⚡ Apply now'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )} {/* end new people */}

            {/* ── Changed people ── */}
            {result.changedPersons.length > 0 && (
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="bg-amber-500 text-white px-6 py-3 flex items-center justify-between">
                  <h3 className="font-bold">Changed People ({result.changedPersons.length})</h3>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => {
                      const a = { ...personActions };
                      result.changedPersons.forEach(p => { if (a[p.geniId] !== 'applied') a[p.geniId] = 'update'; });
                      setPersonActions(a);
                    }} className="bg-amber-400 hover:bg-amber-300 px-3 py-1 rounded-lg">Update all</button>
                    <button onClick={() => {
                      const a = { ...personActions };
                      result.changedPersons.forEach(p => { if (a[p.geniId] !== 'applied') a[p.geniId] = 'skip'; });
                      setPersonActions(a);
                    }} className="bg-amber-700 hover:bg-amber-600 px-3 py-1 rounded-lg">Skip all</button>
                  </div>
                </div>
                <div className="divide-y">
                  {result.changedPersons.map(p => {
                    const { name, dob } = personDisplayName(p);
                    const isApplied = personActions[p.geniId] === 'applied';
                    return (
                      <div key={p.geniId} className={`px-6 py-4 ${isApplied ? 'bg-green-50 opacity-60' : ''}`}>

                        {/* Person header */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <span className="font-medium">{name}</span>
                            <span className="text-gray-400 text-xs ml-2">{dob}</span>
                            {isApplied && <span className="ml-2 text-xs text-green-600 font-medium">✔ Applied</span>}
                          </div>
                          {!isApplied && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => setPersonActions(a => ({ ...a, [p.geniId]: 'update' }))}
                                className={`px-3 py-1 rounded-lg text-xs font-medium
                                  ${personActions[p.geniId] === 'update'
                                    ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                Update selected
                              </button>
                              <button
                                onClick={() => setPersonActions(a => ({ ...a, [p.geniId]: 'skip' }))}
                                className={`px-3 py-1 rounded-lg text-xs font-medium
                                  ${personActions[p.geniId] === 'skip'
                                    ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                Skip
                              </button>
                              <button
                                onClick={() => applyOnePerson(p)}
                                disabled={applyingPerson === p.geniId || personActions[p.geniId] === 'skip'}
                                className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40">
                                {applyingPerson === p.geniId ? '⏳' : '⚡ Apply now'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Field changes — only show if not applied */}
                        {!isApplied && (
                          <div className="space-y-2">
                            {p.changes.map(change => (
                              <div key={change.field}
                                className={`rounded-lg p-3 text-sm
                                  ${change.manuallyEdited ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>

                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-gray-700">{change.label}</span>
                                  {change.manuallyEdited && (
                                    <span className="text-xs text-red-600 font-medium">⚠️ Manually edited</span>
                                  )}
                                </div>

                                {/* Geni → Your Tree */}
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="flex-1 bg-white rounded p-2 border border-orange-200">
                                    <p className="text-xs font-semibold text-orange-600 mb-0.5">🌐 From Geni</p>
                                    <p className="text-green-700 font-medium">{change.newValue || '—'}</p>
                                  </div>
                                  <span className="text-blue-400 text-lg font-bold">→</span>
                                  <div className="flex-1 bg-white rounded p-2 border border-blue-200">
                                    <p className="text-xs font-semibold text-blue-600 mb-0.5">🌳 Your Tree</p>
                                    <p className="text-red-600">{change.existingValue || '—'}</p>
                                  </div>
                                </div>

                                {personActions[p.geniId] === 'update' && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => setFieldResolutions(r => ({
                                        ...r, [p.geniId]: { ...r[p.geniId], [change.field]: 'update' }
                                      }))}
                                      className={`px-3 py-1 rounded text-xs font-medium
                                        ${fieldResolutions[p.geniId]?.[change.field] === 'update'
                                          ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                      ✅ Use Geni value
                                    </button>
                                    <button
                                      onClick={() => setFieldResolutions(r => ({
                                        ...r, [p.geniId]: { ...r[p.geniId], [change.field]: 'keep' }
                                      }))}
                                      className={`px-3 py-1 rounded text-xs font-medium
                                        ${fieldResolutions[p.geniId]?.[change.field] === 'keep'
                                          ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                                      🌳 Keep my value
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )} {/* end field changes */}

                      </div>
                    );
                  })}
                </div>
              </div>
            )} {/* end changed people */}

          </div>
        )} {/* end step reviewing */}

        {/* ── Step 3: Done ── */}
        {step === 'done' && applyResult && (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-blue-900 mb-2">Import Complete!</h2>
            <div className="flex justify-center gap-6 mt-6 mb-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{applyResult.personsAdded}</p>
                <p className="text-sm text-gray-500">People added</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-600">{applyResult.personsUpdated}</p>
                <p className="text-sm text-gray-500">People updated</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-400">{applyResult.personsSkipped}</p>
                <p className="text-sm text-gray-500">Skipped</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{applyResult.familiesAdded}</p>
                <p className="text-sm text-gray-500">Families added</p>
              </div>
            </div>
            <div className="flex justify-center gap-4">
              <Link href="/" className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-medium">
                Back to Family Tree
              </Link>
              <button
                onClick={() => { setStep('upload'); setResult(null); setCurrentFile(null); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl font-medium">
                Import another file
              </button>
            </div>
          </div>
        )} {/* end step done */}

      </div>
    </main>
  );
} // end of ImportReviewPage
