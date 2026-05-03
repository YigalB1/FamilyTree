'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
} // end of Person interface

interface FamilyMember {
  id:            string;
  first_name_he: string;
  last_name_he:  string;
  first_name_en: string;
  last_name_en:  string;
  birth_date:    string;
  sex:           string;
} // end of FamilyMember interface

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
} // end of Family interface

interface ChangeLogEntry {
  id:              string;
  field:           string;
  old_value:       string;
  new_value:       string;
  changed_at:      string;
  changed_by_name: string;
  source:          string;
} // end of ChangeLogEntry interface

type RelationshipType = 'child' | 'spouse' | 'parent' | 'sibling';

interface AddPersonForm {
  first_name_he:  string;
  last_name_he:   string;
  first_name_en:  string;
  last_name_en:   string;
  sex:            string;
  birth_date:     string;
  birth_place:    string;
  death_date:     string;
  death_place:    string;
  notes:          string;
  marriage_date:  string;
  marriage_place: string;
  divorced:       boolean;
} // end of AddPersonForm interface

const EMPTY_FORM: AddPersonForm = {
  first_name_he: '', last_name_he: '', first_name_en: '', last_name_en: '',
  sex: '', birth_date: '', birth_place: '', death_date: '', death_place: '',
  notes: '', marriage_date: '', marriage_place: '', divorced: false,
}; // end EMPTY_FORM

// ── Helper ────────────────────────────────────────────────────────

function personName(fhe: string, lhe: string, fen: string, len: string) {
  const he = `${fhe || ''} ${lhe || ''}`.trim();
  const en = `${fen || ''} ${len || ''}`.trim();
  if (he && en) return `${he} / ${en}`;
  return he || en || '—';
} // end of personName

// ── EditField — defined OUTSIDE PersonPage ────────────────────────

interface EditFieldProps {
  label:    string;
  fieldKey: keyof Person;
  form:     Partial<Person>;
  setForm:  React.Dispatch<React.SetStateAction<Partial<Person>>>;
  editing:  boolean;
  person:   Person | null;
} // end of EditFieldProps interface

function EditField({ label, fieldKey, form, setForm, editing, person }: EditFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {editing ? (
        <input type="text" value={(form[fieldKey] as string) || ''}
          onChange={e => setForm(f => ({ ...f, [fieldKey]: e.target.value }))}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
      ) : (
        <p className="text-sm text-gray-800 py-2 border-b border-gray-100">
          {(person?.[fieldKey] as string) || <span className="text-gray-400 italic">—</span>}
        </p>
      )}
    </div>
  );
} // end of EditField

// ── AddPersonModal — defined OUTSIDE PersonPage ───────────────────

interface AddPersonModalProps {
  relationship:  RelationshipType;
  relatedPerson: Person;
  families:      Family[];
  onClose:       () => void;
  onSaved:       (newId: string) => void;
} // end of AddPersonModalProps interface

function AddPersonModal({ relationship, relatedPerson, families, onClose, onSaved }: AddPersonModalProps) {
  const [form,     setForm]     = useState<AddPersonForm>(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [familyId, setFamilyId] = useState('');

  function setField(key: keyof AddPersonForm, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  } // end of setField

  const labels: Record<RelationshipType, string> = {
    child: '+ Add Child', spouse: '+ Add Spouse',
    parent: '+ Add Parent', sibling: '+ Add Sibling',
  }; // end labels

  const relatedName = `${relatedPerson.first_name_he || relatedPerson.first_name_en || ''} ${relatedPerson.last_name_he || relatedPerson.last_name_en || ''}`.trim();

  async function handleSave() {
    const hasName = form.first_name_he || form.last_name_he ||
                    form.first_name_en || form.last_name_en;
    if (!hasName) { setError('Please enter at least one name field'); return; }
    setSaving(true);
    setError('');
    try {
      const res  = await fetch('/api/persons/add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, relationship,
          relatedPersonId: relatedPerson.id,
          familyId: familyId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onSaved(data.person.id);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  } // end of handleSave

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-blue-900 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{labels[relationship]}</h2>
            <p className="text-blue-300 text-sm mt-0.5">
              {relationship === 'child'   && `Adding child of ${relatedName}`}
              {relationship === 'spouse'  && `Adding spouse of ${relatedName}`}
              {relationship === 'parent'  && `Adding parent of ${relatedName}`}
              {relationship === 'sibling' && `Adding sibling of ${relatedName}`}
            </p>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-6 space-y-5">

          {/* Names */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">Names</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'First name (Hebrew)',  key: 'first_name_he' as keyof AddPersonForm },
                { label: 'Last name (Hebrew)',   key: 'last_name_he'  as keyof AddPersonForm },
                { label: 'First name (English)', key: 'first_name_en' as keyof AddPersonForm },
                { label: 'Last name (English)',  key: 'last_name_en'  as keyof AddPersonForm },
              ].map(({ label, key }) => (
                <label key={key} className="flex flex-col gap-1 text-sm text-gray-600">
                  {label}
                  <input type="text" value={form[key] as string}
                    onChange={e => setField(key, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </label>
              ))}
              <label className="flex flex-col gap-1 text-sm text-gray-600 col-span-2">
                Sex
                <select value={form.sex} onChange={e => setField('sex', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">Unknown</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </label>
            </div>
          </div>

          {/* Dates & Places */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-3 text-sm uppercase tracking-wide">Dates & Places</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Birth date',  key: 'birth_date'  as keyof AddPersonForm, ph: 'e.g. 22 JAN 1961' },
                { label: 'Birth place', key: 'birth_place' as keyof AddPersonForm, ph: '' },
                { label: 'Death date',  key: 'death_date'  as keyof AddPersonForm, ph: 'e.g. 15 MAR 2010' },
                { label: 'Death place', key: 'death_place' as keyof AddPersonForm, ph: '' },
              ].map(({ label, key, ph }) => (
                <label key={key} className="flex flex-col gap-1 text-sm text-gray-600">
                  {label}
                  <input type="text" value={form[key] as string} placeholder={ph}
                    onChange={e => setField(key, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </label>
              ))}
            </div>
          </div>

          {/* Spouse fields */}
          {relationship === 'spouse' && (
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-3 text-sm uppercase tracking-wide">Marriage Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  Marriage date
                  <input type="text" value={form.marriage_date} placeholder="e.g. 10 JUN 1990"
                    onChange={e => setField('marriage_date', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-600">
                  Marriage place
                  <input type="text" value={form.marriage_place}
                    onChange={e => setField('marriage_place', e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
                  <input type="checkbox" checked={form.divorced}
                    onChange={e => setField('divorced', e.target.checked)} className="w-4 h-4" />
                  This marriage ended in divorce
                </label>
              </div>
            </div>
          )} {/* end spouse fields */}

          {/* Child — family selector */}
          {relationship === 'child' && families.length > 1 && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2 text-sm uppercase tracking-wide">
                Which family? ({families.length} marriages)
              </h3>
              <select value={familyId} onChange={e => setFamilyId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">First / default family</option>
                {families.map((f, i) => {
                  const spouseName = f.husband_id === relatedPerson.id
                    ? personName(f.wife_first_he, f.wife_last_he, f.wife_first_en, f.wife_last_en)
                    : personName(f.husb_first_he, f.husb_last_he, f.husb_first_en, f.husb_last_en);
                  return (
                    <option key={f.id} value={f.id}>
                      Marriage {i + 1} — with {spouseName}{f.marriage_date ? ` (${f.marriage_date})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          )} {/* end child family selector */}

          {/* Notes */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h3 className="font-semibold text-blue-900 mb-2 text-sm uppercase tracking-wide">Notes</h3>
            <textarea value={form.notes} rows={3}
              onChange={e => setField('notes', e.target.value)}
              placeholder="Optional notes about this person"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-lg px-4 py-2">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {saving ? '⏳ Saving…' : `💾 Save ${relationship}`}
            </button>
            <button onClick={onClose}
              className="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-xl font-medium">
              Cancel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
} // end of AddPersonModal

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
  const [addModal,     setAddModal]     = useState<RelationshipType | null>(null);

  useEffect(() => { loadPerson(); }, [id]); // end useEffect

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
  } // end of loadPerson

  async function handleSave() {
    if (!person) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const res  = await fetch(`/api/persons/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
  } // end of handleSave

  function handleAddSaved(newPersonId: string) {
    setAddModal(null);
    setSaveMsg('✅ Person added successfully');
    loadPerson();
  } // end of handleAddSaved

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
  const bgColor     = person.sex === 'M' ? 'bg-blue-50 border-blue-200'
    : person.sex === 'F' ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-200';
  const editFieldProps = { form, setForm, editing, person };

  return (
    <main className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <Link href="/" className="text-sm hover:opacity-80">← Back to Family Tree</Link>
        <h1 className="text-lg font-bold">{displayName}</h1>
        <div className="w-32" />
      </div>

      <div className="max-w-4xl mx-auto p-8">

        {/* Person header */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${bgColor}`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
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

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              {!editing ? (
                <>
                  <button onClick={() => { setEditing(true); setSaveMsg(''); }}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    ✏️ Edit
                  </button>
                  <button onClick={() => setAddModal('child')}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    + Child
                  </button>
                  <button onClick={() => setAddModal('spouse')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    + Spouse
                  </button>
                  <button onClick={() => setAddModal('parent')}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    + Parent
                  </button>
                  <button onClick={() => setAddModal('sibling')}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg text-sm font-medium">
                    + Sibling
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setEditing(false); setForm(person); setSaveMsg(''); }}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? 'Saving…' : '💾 Save'}
                  </button>
                </>
              )} {/* end edit/view buttons */}
            </div>
          </div>

          {saveMsg && (
            <p className={`mt-3 text-sm font-medium ${saveMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {saveMsg}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* Left — details */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Names</h3>
              <div className="space-y-3">
                <EditField label="First name (Hebrew)"  fieldKey="first_name_he" {...editFieldProps} />
                <EditField label="Last name (Hebrew)"   fieldKey="last_name_he"  {...editFieldProps} />
                <EditField label="First name (English)" fieldKey="first_name_en" {...editFieldProps} />
                <EditField label="Last name (English)"  fieldKey="last_name_en"  {...editFieldProps} />
                {editing && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sex</label>
                    <select value={form.sex || ''}
                      onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">Unknown</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Dates & Places</h3>
              <div className="space-y-3">
                <EditField label="Birth date"  fieldKey="birth_date"  {...editFieldProps} />
                <EditField label="Birth place" fieldKey="birth_place" {...editFieldProps} />
                <EditField label="Death date"  fieldKey="death_date"  {...editFieldProps} />
                <EditField label="Death place" fieldKey="death_place" {...editFieldProps} />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Notes</h3>
              {editing ? (
                <textarea value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              ) : (
                <p className="text-sm text-gray-800">
                  {person.notes || <span className="text-gray-400 italic">No notes</span>}
                </p>
              )}
            </div>
          </div>

          {/* Right — family */}
          <div className="space-y-4">

            {parentFamily && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Parents</h3>
                <div className="space-y-2">
                  {parentFamily.husband_id && (
                    <Link href={`/person/${parentFamily.husband_id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 text-sm">
                      <span className="text-blue-500">♂</span>
                      <span className="font-medium">
                        {personName(parentFamily.husb_first_he, parentFamily.husb_last_he,
                          parentFamily.husb_first_en, parentFamily.husb_last_en)}
                      </span>
                    </Link>
                  )}
                  {parentFamily.wife_id && (
                    <Link href={`/person/${parentFamily.wife_id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-pink-50 text-sm">
                      <span className="text-pink-500">♀</span>
                      <span className="font-medium">
                        {personName(parentFamily.wife_first_he, parentFamily.wife_last_he,
                          parentFamily.wife_first_en, parentFamily.wife_last_en)}
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {families.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">
                  {families.length === 1 ? 'Spouse' : 'Spouses'}
                </h3>
                <div className="space-y-3">
                  {families.map(fam => {
                    const isHusband = fam.husband_id === person.id;
                    const spouseId  = isHusband ? fam.wife_id : fam.husband_id;
                    const sfhe = isHusband ? fam.wife_first_he : fam.husb_first_he;
                    const slhe = isHusband ? fam.wife_last_he  : fam.husb_last_he;
                    const sfen = isHusband ? fam.wife_first_en : fam.husb_first_en;
                    const slen = isHusband ? fam.wife_last_en  : fam.husb_last_en;
                    return (
                      <div key={fam.id} className="border-b last:border-0 pb-3 last:pb-0">
                        {spouseId ? (
                          <Link href={`/person/${spouseId}`}
                            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm">
                            <span className={isHusband ? 'text-pink-500' : 'text-blue-500'}>
                              {isHusband ? '♀' : '♂'}
                            </span>
                            <span className="font-medium">{personName(sfhe, slhe, sfen, slen)}</span>
                            {fam.divorced && <span className="text-xs text-gray-400 ml-auto">divorced</span>}
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
                        {personName(child.first_name_he, child.last_name_he,
                          child.first_name_en, child.last_name_en)}
                      </span>
                      {child.birth_date && (
                        <span className="text-gray-400 text-xs ml-auto">b. {child.birth_date}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {changeLog.length > 0 && (
              <div className="bg-white rounded-2xl shadow p-6">
                <h3 className="font-bold text-blue-900 mb-4 border-b pb-2">Change History</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {changeLog.map(entry => (
                    <div key={entry.id} className="text-xs border-b border-gray-100 pb-2 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-blue-800">{entry.field}</span>
                        <span className="text-gray-400">{new Date(entry.changed_at).toLocaleDateString()}</span>
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

      {/* Add Person Modal */}
      {addModal && person && (
        <AddPersonModal
          relationship={addModal}
          relatedPerson={person}
          families={families}
          onClose={() => setAddModal(null)}
          onSaved={handleAddSaved}
        />
      )} {/* end add modal */}

    </main>
  );
} // end of PersonPage
