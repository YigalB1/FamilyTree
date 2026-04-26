'use client';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done' | 'error'>('idle');
  const [summary, setSummary] = useState('');

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setStatus('parsing');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      // Count individuals and families as a quick parse check
      const individuals = (text.match(/^0 @.*@ INDI/gm) || []).length;
      const families   = (text.match(/^0 @.*@ FAM/gm)  || []).length;
      setSummary(`Found ${individuals} people and ${families} families.`);
      setStatus('done');
      // TODO: send to backend / Neo4j in next phase
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.ged', '.gedcom'] },
    multiple: false,
  });

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-blue-900 mb-2">Family Tree</h1>
      <p className="text-gray-500 mb-10">Import your family data to get started</p>

      <div
        {...getRootProps()}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400'}`}
      >
        <input {...getInputProps()} />
        <div className="text-5xl mb-4">🌳</div>
        <p className="text-lg font-semibold text-gray-700 mb-2">
          Import GEDCOM from Geni
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Drag & drop your .ged file here, or click to browse
        </p>
        <button className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors">
          Choose GEDCOM File
        </button>
      </div>

      {status === 'parsing' && (
        <p className="mt-6 text-blue-600 animate-pulse">Parsing your file…</p>
      )}
      {status === 'done' && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl px-6 py-4 text-center">
          <p className="text-green-700 font-semibold">✅ File loaded successfully</p>
          <p className="text-green-600 text-sm mt-1">{summary}</p>
        </div>
      )}
      {status === 'error' && (
        <p className="mt-6 text-red-500">Something went wrong. Please try a valid .ged file.</p>
      )}

      <p className="mt-10 text-xs text-gray-400">
        To export from Geni: go to <strong>Geni.com → Settings → Export Family Tree → GEDCOM</strong>
      </p>
    </main>
  );
}