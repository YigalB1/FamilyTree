'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push('/');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-blue-900 mb-2 text-center">🌳 Family Tree</h1>
        <p className="text-gray-500 text-center mb-8">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Email
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="your@email.com"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Password
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              className="border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            className="bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          No account yet?{' '}
          <Link href="/register" className="text-blue-700 hover:underline font-medium">
            Register here
          </Link>
        </p>
      </div>
    </main>
  );
}
