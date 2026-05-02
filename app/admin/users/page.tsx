'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
  id:         string;
  email:      string;
  name:       string;
  role:       'admin' | 'editor' | 'viewer';
  created_at: string;
  last_login: string | null;
} // end of User interface

const ROLE_COLORS: Record<string, string> = {
  admin:  'bg-red-100 text-red-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}; // end ROLE_COLORS

const ROLE_LABELS: Record<string, string> = {
  admin:  '👑 Admin',
  editor: '✏️ Editor',
  viewer: '👁 Viewer',
}; // end ROLE_LABELS

export default function UsersPage() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showAdd,     setShowAdd]     = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [msg,         setMsg]         = useState('');

  // New user form
  const [newEmail,    setNewEmail]    = useState('');
  const [newName,     setNewName]     = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole,     setNewRole]     = useState<'admin'|'editor'|'viewer'>('viewer');
  const [adding,      setAdding]      = useState(false);

  // Edit user form
  const [editRole,     setEditRole]     = useState<'admin'|'editor'|'viewer'>('viewer');
  const [editName,     setEditName]     = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [saving,       setSaving]       = useState(false);

  // ── Load users ──────────────────────────────────────────────────
  async function loadUsers() {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setUsers(data.users);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  } // end of loadUsers

  useEffect(() => { loadUsers(); }, []); // end useEffect

  // ── Add new user ────────────────────────────────────────────────
  async function handleAddUser() {
    setAdding(true);
    setMsg('');
    try {
      const res  = await fetch('/api/admin/users', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: newEmail, name: newName, password: newPassword, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
      setMsg(`✅ User ${newName} created successfully`);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('viewer');
      setShowAdd(false);
      await loadUsers();
    } catch {
      setMsg('❌ Failed to create user');
    } finally {
      setAdding(false);
    }
  } // end of handleAddUser

  // ── Start editing user ──────────────────────────────────────────
  function startEdit(user: User) {
    setEditingId(user.id);
    setEditRole(user.role);
    setEditName(user.name);
    setEditPassword('');
    setMsg('');
  } // end of startEdit

  // ── Save user edit ──────────────────────────────────────────────
  async function handleSaveEdit(userId: string) {
    setSaving(true);
    setMsg('');
    try {
      const body: any = { role: editRole, name: editName };
      if (editPassword) body.password = editPassword;

      const res  = await fetch(`/api/admin/users/${userId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
      setMsg('✅ User updated successfully');
      setEditingId(null);
      await loadUsers();
    } catch {
      setMsg('❌ Failed to update user');
    } finally {
      setSaving(false);
    }
  } // end of handleSaveEdit

  // ── Delete user ─────────────────────────────────────────────────
  async function handleDelete(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to delete user "${userName}"? This cannot be undone.`)) return;
    setMsg('');
    try {
      const res  = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
      setMsg(`✅ User ${userName} deleted`);
      await loadUsers();
    } catch {
      setMsg('❌ Failed to delete user');
    }
  } // end of handleDelete

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString();
  } // end of formatDate

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">👥 User Management</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-4xl mx-auto p-8">

        {/* Message banner */}
        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium
            ${msg.startsWith('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {msg}
            <button onClick={() => setMsg('')} className="ml-4 opacity-60 hover:opacity-100">✕</button>
          </div>
        )} {/* end message banner */}

        {/* Header + Add button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-blue-900">Users</h2>
            <p className="text-sm text-gray-500 mt-1">{users.length} registered user{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setMsg(''); }}
            className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            + Add User
          </button>
        </div>

        {/* Add user form */}
        {showAdd && (
          <div className="bg-white rounded-2xl shadow p-6 mb-6 border-2 border-blue-200">
            <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Add New User</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Full name
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Email
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Password (min 6 characters)
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Password"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600">
                Role
                <select value={newRole} onChange={e => setNewRole(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="viewer">👁 Viewer — view only</option>
                  <option value="editor">✏️ Editor — view and edit</option>
                  <option value="admin">👑 Admin — full access</option>
                </select>
              </label>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAddUser}
                disabled={adding || !newEmail || !newName || !newPassword}
                className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {adding ? 'Creating…' : 'Create User'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setNewEmail(''); setNewName(''); setNewPassword(''); }}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )} {/* end add user form */}

        {/* Error */}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* Loading */}
        {loading && (
          <p className="text-center text-blue-600 animate-pulse py-12">Loading users…</p>
        )}

        {/* Users list */}
        {!loading && (
          <div className="space-y-4">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-2xl shadow p-6">

                {editingId === u.id ? (
                  /* ── Edit mode ── */
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <label className="flex flex-col gap-1 text-sm text-gray-600">
                        Full name
                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-gray-600">
                        Role
                        <select value={editRole} onChange={e => setEditRole(e.target.value as any)}
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                          <option value="viewer">👁 Viewer</option>
                          <option value="editor">✏️ Editor</option>
                          <option value="admin">👑 Admin</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-gray-600 col-span-2">
                        New password (leave blank to keep current)
                        <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)}
                          placeholder="Leave blank to keep current password"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleSaveEdit(u.id)}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : '💾 Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-blue-900">{u.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{u.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Joined {formatDate(u.created_at)}
                        {u.last_login && ` · Last login ${formatDate(u.last_login)}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(u)}
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                )} {/* end view/edit mode */}

              </div>
            ))} {/* end users map */}
          </div>
        )} {/* end users list */}

        {/* Role legend */}
        <div className="mt-8 bg-white rounded-2xl shadow p-6">
          <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Role Permissions</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${ROLE_COLORS.admin}`}>
                {ROLE_LABELS.admin}
              </p>
              <ul className="text-gray-600 space-y-1 text-xs">
                <li>✅ View everything</li>
                <li>✅ Edit all profiles</li>
                <li>✅ Import GEDCOM</li>
                <li>✅ Backup database</li>
                <li>✅ Manage users</li>
                <li>✅ Delete records</li>
              </ul>
            </div>
            <div>
              <p className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${ROLE_COLORS.editor}`}>
                {ROLE_LABELS.editor}
              </p>
              <ul className="text-gray-600 space-y-1 text-xs">
                <li>✅ View everything</li>
                <li>✅ Edit all profiles</li>
                <li>✅ Import GEDCOM</li>
                <li>❌ Backup database</li>
                <li>❌ Manage users</li>
                <li>❌ Delete records</li>
              </ul>
            </div>
            <div>
              <p className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${ROLE_COLORS.viewer}`}>
                {ROLE_LABELS.viewer}
              </p>
              <ul className="text-gray-600 space-y-1 text-xs">
                <li>✅ View everything</li>
                <li>✅ Export PDF/Excel</li>
                <li>❌ Edit profiles</li>
                <li>❌ Import GEDCOM</li>
                <li>❌ Backup database</li>
                <li>❌ Manage users</li>
              </ul>
            </div>
          </div>
        </div> {/* end role legend */}

      </div>
    </main>
  );
} // end of UsersPage
