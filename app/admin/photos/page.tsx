'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DownloadStatus {
  totalGeni:  number;
  localCount: number;
  remaining:  number;
} // end of DownloadStatus interface

interface DownloadResult {
  downloaded: number;
  skipped:    number;
  failed:     number;
  failures:   string[];
  total:      number;
} // end of DownloadResult interface

export default function PhotosAdminPage() {
  const [status,      setStatus]      = useState<DownloadStatus | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [result,      setResult]      = useState<DownloadResult | null>(null);
  const [error,       setError]       = useState('');

  // ── Load status on mount ──────────────────────────────────────
  async function loadStatus() {
    setLoading(true);
    try {
      const res  = await fetch('/api/photos/download-all');
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setStatus(data);
    } catch {
      setError('Failed to load photo status');
    } finally {
      setLoading(false);
    }
  } // end of loadStatus

  useEffect(() => { loadStatus(); }, []); // end useEffect

  // ── Download all Geni photos ──────────────────────────────────
  async function handleDownloadAll() {
    if (!confirm(
      `This will download ${status?.remaining} photos from Geni to your local computer.\n\n` +
      `This may take several minutes. Do not close the browser tab.\n\nContinue?`
    )) return;

    setDownloading(true);
    setResult(null);
    setError('');
    try {
      const res  = await fetch('/api/photos/download-all', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setResult(data);
      await loadStatus(); // Refresh counts
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  } // end of handleDownloadAll

  const allDownloaded = status && status.remaining === 0 && status.localCount > 0;

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">📸 Photo Management</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-2xl mx-auto p-8">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <p className="text-center text-blue-600 animate-pulse py-12">Loading photo status…</p>
        )}

        {/* Status card */}
        {!loading && status && (
          <div className="bg-white rounded-2xl shadow p-8 mb-6">
            <h2 className="text-xl font-bold text-blue-900 mb-6">Geni Photo Status</h2>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-700">{status.totalGeni}</p>
                <p className="text-sm text-gray-500 mt-1">Photos on Geni</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-700">{status.localCount}</p>
                <p className="text-sm text-gray-500 mt-1">Downloaded locally</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${status.remaining > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <p className={`text-3xl font-bold ${status.remaining > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                  {status.remaining}
                </p>
                <p className="text-sm text-gray-500 mt-1">Still on Geni only</p>
              </div>
            </div>

            {/* Progress bar */}
            {status.totalGeni > 0 && (
              <div className="mb-8">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Local storage</span>
                  <span>{Math.round((status.localCount / status.totalGeni) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(status.localCount / status.totalGeni) * 100}%` }}
                  />
                </div>
              </div>
            )} {/* end progress bar */}

            {/* All clear */}
            {allDownloaded && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center mb-6">
                <p className="text-green-700 font-semibold">✅ All photos downloaded locally!</p>
                <p className="text-green-600 text-sm mt-1">
                  Photos are now stored on your computer and will work offline.
                </p>
              </div>
            )} {/* end all clear */}

            {/* Download button */}
            {status.remaining > 0 && (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <p className="font-medium mb-1">⚠️ {status.remaining} photos still loading from Geni</p>
                  <p>These photos depend on Geni's servers. Click below to download them permanently to your computer.</p>
                </div>
                <button
                  onClick={handleDownloadAll}
                  disabled={downloading}
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50"
                >
                  {downloading
                    ? '⏳ Downloading photos… please wait'
                    : `⬇ Download ${status.remaining} photos from Geni`}
                </button>
                {downloading && (
                  <p className="text-center text-sm text-gray-500 animate-pulse">
                    This may take a few minutes. Do not close this tab.
                  </p>
                )}
              </div>
            )} {/* end download button */}

            {/* Refresh button */}
            <button
              onClick={loadStatus}
              className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-sm font-medium"
            >
              🔄 Refresh status
            </button>
          </div>
        )} {/* end status card */}

        {/* Download result */}
        {result && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Download Complete</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.downloaded}</p>
                <p className="text-xs text-gray-500">Downloaded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-400">{result.skipped}</p>
                <p className="text-xs text-gray-500">Already local</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{result.failed}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>
            {result.failures.length > 0 && (
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm font-medium text-red-700 mb-2">Failed downloads:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {result.failures.map((f, i) => (
                    <li key={i}>• {f}</li>
                  ))}
                </ul>
                {result.failed > result.failures.length && (
                  <p className="text-xs text-red-400 mt-2">
                    ...and {result.failed - result.failures.length} more
                  </p>
                )}
              </div>
            )} {/* end failures */}
          </div>
        )} {/* end result */}

        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mt-6">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ How photos work</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>🌐 <strong>Geni photos</strong> — loaded from Geni's servers each time. May break if Geni changes URLs.</li>
            <li>💾 <strong>Local photos</strong> — stored on your computer. Permanent, works offline.</li>
            <li>📷 <strong>Upload local</strong> — on any profile you can upload a local photo to replace the Geni one.</li>
            <li>☁️ <strong>Cloud migration</strong> — when you deploy to the cloud, copy the photos/ folder alongside your code.</li>
          </ul>
        </div>

      </div>
    </main>
  );
} // end of PhotosAdminPage
