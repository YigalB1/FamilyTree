'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Person {
  id:            string;
  geni_id:       string;
  first_name_he: string;
  last_name_he:  string;
  first_name_en: string;
  last_name_en:  string;
  sex:           string;
  birth_date:    string;
  birth_place:   string;
  death_date:    string;
  death_place:   string;
  notes:         string;
  updated_at:    string;
}

interface FamilyMember {
  id:            string;
  first_name_he: string;
  last_name_he:  string;
  first_name_en: string;
  last_name_en:  string;
  birth_date:    string;
  sex:           string;
}

interface Family {
  id:            string;
  husband_id:    string;
  wife_id:       string;
  marriage_date: string;
  divorced:      boolean;
  husb_first_he: string;
  husb_last_he:  string;
  husb_first_en: string;
  husb_last_en:  string;
  wife_first_he: string;
  wife_last_he:  string;
  wife_first_en: string;
  wife_last_en:  string;
}

interface ChangeLogEntry {
  id:              string;
  field:           string;
  old_value:       string;
  new_value:       string;
  changed_at:      string;
  changed_by_name: string;
  source:          string;
}

// ── Field component — defined OUTSIDE PersonPage to prevent re-render focus loss ──

interface FieldProps {
  label:    string;
  fieldKey: keyof Person;
  form:     Partial<Person>;
  setForm:  React.Dispatch<React.SetStateAction<Partial<Person>>>;
  editing:  boolean;
  person:   Person | null;
}

function Field({ label, fieldKey, form, setForm, editing, person }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      {editing ? (
        <input
          type="text"
          value={(form[fieldKey] as string) || ''}
          onChange={e => setForm(f => ({ ...f, [fieldKey]: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      ) : (
        <p className="text-sm text-gray-800 py-2 border-b border-gray-100">
          {(person?.[fieldKey] as string) || (
            <span className="text-gray-400 italic">—</span>
          )}
        </p>
      )}
    </div>
  );
}

// ── Helper ────────────────────────────────────────────────────────

function personName(fhe: string, lhe: string, fen: string, len: string) {
  const he = `${fhe || ''} ${lhe || ''}`.trim();
  const en = `${fen || ''} ${len || ''}`.trim();
  if (he && en) return `${he} / ${en}`;
  return he || en || '—';
}

// ── Main page ─────────────────────────────────────────────────────

export default function PersonPage() {
  const params = useParams();
  const id     = params.id as string;

  const [person,       setPerson]       = useState<Person | null>(null);
  const [families,     setFamilies]     = useState<Family[]>([]);
  const [parentFamily, setParentFamily] = useState<Family | null>(null);
  const [children,     setChildren]     = useState<FamilyMember[]>([]);
  const [changeLog,    setChangeLog]    = useState<ChangeLogEntry[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editing,      setEditing]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');
  const [saveMsg,      setSaveMsg]      = useState('');
  const [form,         setForm]         = useState<Partial<Person>>({});

  useEffect(() => { loadPerson(); }, [id]);

  async function loadPerson() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/persons/${id}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setPerson(data.person);
      setFamilies(data.families);
      setParentFamily(data.parentFamily);
      setChildren(data.children);
      setChangeLog(data.changeLog);
      setForm(data.person);
    } catch {
      setError('Failed to load person');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!person) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res  = await fetch(`/api/persons/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setSaveMsg(`❌ ${data.error}`); return; }
      setPerson(data.person);
      setForm(data.person);
      setEditing(false);
      setSaveMsg('✅ Saved successfully');
      await loadPerson();
    } catch {
      setSaveMsg('❌ Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────

  if (loading) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-blue-600 animate-pulse text-lg">Loading…</p>
    </main>
  );

  if (error) return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/" className="text-blue-700 hover:underline">← Back to tree</Link>
      </div>
    </main>
  );

  if (!person) return null;

  const displayName = `${person.first_name_he || person.first_name_en || ''} ${person.last_name_he || person.last_name_en || ''}`.trim();
  const bgColor     = person.sex === 'M'
    ? 'bg-blue-50 border-blue-200'
    : person.sex === 'F'
    ? 'bg-pink-50 border-pink-200'
    : 'bg-gray-50 border-gray-200';

  // Shared props for Field components
  const fieldProps = { form, setForm, editing, person };

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">{displayName}</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-4xl mx-auto p-8">

        {/* Person header card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${bgColor}`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-blue-900">{displayName}</h2>
              <p className="text-gray-500 text-sm mt-1">
                {person.sex === 'M' ? '♂ Male' : person.sex === 'F' ? '♀ Female' : 'Unknown gender'}
                {person.birth_date && ` · b. ${person.birth_date}`}
                {person.death_date && ` · d. ${person.death_date}`}
              </p>
              {person.geni_id && (
                <p className="text-xs text-gray-400 mt-1">Geni ID: {person.geni_id}</p>
              )}
            </div>
            <div className="flex gap-2">
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setSaveMsg(''); }}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  ✏️ Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setEditing(false); setForm(person); setSaveMsg(''); }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : '💾 Save'}
                  </button>
                </>
              )}
            </div>
          </div>
          {saveMsg && (
            <p className={`mt-3 text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {saveMsg}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* ── Left column — details ── */}
          <div className="space-y-4">

            {/* Names */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Names</h3>
              <div className="space-y-3">
                <Field label="First name (Hebrew)"  fieldKey="first_name_he" {...fieldProps} />
                <Field label="Last name (Hebrew)"   fieldKey="last_name_he"  {...fieldProps} />
                <Field label="First name (English)" fieldKey="first_name_en" {...fieldProps} />
                <Field label="Last name (English)"  fieldKey="last_name_en"  {...fieldProps} />
                {editing && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sex</label>
                    <select
                      value={form.sex || ''}
                      onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Unknown</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Dates & Places */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Dates & Places</h3>
              <div className="space-y-3">
                <Field label="Birth date"  fieldKey="birth_date"  {...fieldProps} />
                <Field label="Birth place" fieldKey="birth_place" {...fieldProps} />
                <Field label="Death date"  fieldKey="death_date"  {...fieldProps} />
                <Field label="Death place" fieldKey="death_place" {...fieldProps} />
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Notes</h3>
              {editing ? (
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ) : (
                <p className="text-sm text-gray-800">
                  {person.notes || <span className="text-gray-400 italic">No notes</span>}
                </p>
              )}
            </div>
          </div>

          {/* ── Right column — family ── */}
          <div className="space-y-4">

            {/* Parents */}
            {parentFamily && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Parents</h3>
                <div className="space-y-2">
                  {parentFamily.husband_id && (
                    <Link href={`/person/${parentFamily.husband_id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 text-sm">
                      <span className="text-blue-500">♂</span>
                      <span className="font-medium">
                        {personName(
                          parentFamily.husb_first_he, parentFamily.husb_last_he,
                          parentFamily.husb_first_en, parentFamily.husb_last_en
                        )}
                      </span>
                    </Link>
                  )}
                  {parentFamily.wife_id && (
                    <Link href={`/person/${parentFamily.wife_id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-pink-50 text-sm">
                      <span className="text-pink-500">♀</span>
                      <span className="font-medium">
                        {personName(
                          parentFamily.wife_first_he, parentFamily.wife_last_he,
                          parentFamily.wife_first_en, parentFamily.wife_last_en
                        )}
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Spouses */}
            {families.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">
                  {families.length === 1 ? 'Spouse' : 'Spouses'}
                </h3>
                <div className="space-y-3">
                  {families.map(fam => {
                    const isHusband = fam.husband_id === person.id;
                    const spouseId  = isHusband ? fam.wife_id    : fam.husband_id;
                    const sfhe      = isHusband ? fam.wife_first_he  : fam.husb_first_he;
                    const slhe      = isHusband ? fam.wife_last_he   : fam.husb_last_he;
                    const sfen      = isHusband ? fam.wife_first_en  : fam.husb_first_en;
                    const slen      = isHusband ? fam.wife_last_en   : fam.husb_last_en;
                    const isFemale  = !isHusband;
                    return (
                      <div key={fam.id} className="border-b last:border-0 pb-3 last:pb-0">
                        {spouseId ? (
                          <Link href={`/person/${spouseId}`}
                            className={`flex items-center gap-2 p-2 rounded-lg text-sm
                              ${isFemale ? 'hover:bg-blue-50' : 'hover:bg-pink-50'}`}>
                            <span className={isFemale ? 'text-blue-500' : 'text-pink-500'}>
                              {isFemale ? '♂' : '♀'}
                            </span>
                            <span className="font-medium">
                              {personName(sfhe, slhe, sfen, slen)}
                            </span>
                            {fam.divorced && (
                              <span className="text-xs text-gray-400 ml-auto">divorced</span>
                            )}
                          </Link>
                        ) : (
                          <p className="text-sm text-gray-400 italic p-2">Unknown spouse</p>
                        )}
                        {fam.marriage_date && (
                          <p className="text-xs text-gray-400 ml-4">m. {fam.marriage_date}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Children */}
            {children.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">
                  Children ({children.length})
                </h3>
                <div className="space-y-1">
                  {children.map(child => (
                    <Link key={child.id} href={`/person/${child.id}`}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm
                        ${child.sex === 'M' ? 'hover:bg-blue-50' : 'hover:bg-pink-50'}`}>
                      <span className={child.sex === 'M' ? 'text-blue-500' : 'text-pink-500'}>
                        {child.sex === 'M' ? '♂' : '♀'}
                      </span>
                      <span className="font-medium">
                        {personName(
                          child.first_name_he, child.last_name_he,
                          child.first_name_en, child.last_name_en
                        )}
                      </span>
                      {child.birth_date && (
                        <span className="text-gray-400 text-xs ml-auto">
                          b. {child.birth_date}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Change log */}
            {changeLog.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Change History</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {changeLog.map(entry => (
                    <div key={entry.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-800">{entry.field}</span>
                        <span className="text-gray-400">
                          {new Date(entry.changed_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-red-400 line-through">{entry.old_value || '—'}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600">{entry.new_value || '—'}</span>
                      </div>
                      <p className="text-gray-400 mt-0.5">
                        by {entry.changed_by_name || 'system'} · {entry.source}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
