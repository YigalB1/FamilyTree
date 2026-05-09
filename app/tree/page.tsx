'use client';
import React from 'react';
import { useState, useEffect, useRef } from 'react';
type Lang = 'he' | 'en' | 'all';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface DbPerson {
  id:                string;
  first_name_he:     string;
  last_name_he:      string;
  first_name_en:     string;
  last_name_en:      string;
  birth_last_name_he: string;
  birth_last_name_en: string;
  sex:               string;
  birth_date:        string;
  death_date:        string;
} // end DbPerson

interface DbFamily {
  id:            string;
  husband_id:    string;
  wife_id:       string;
  children_ids:  string[];
  divorced:      boolean;
  marriage_date: string;
} // end DbFamily

interface TreeCard {
  person:       DbPerson;
  x:            number;
  y:            number;
  spouseId:     string | null;
  spousePerson: DbPerson | null;
  children:     string[];
  divorced:     boolean;
  marriageDate: string;
} // end TreeCard

const CARD_W     = 150;
const CARD_H     = 72;
const H_GAP      = 24;
const V_GAP      = 80;
const SPOUSE_GAP = 32;

// ── Layout engine ─────────────────────────────────────────────────

function buildLayout(
  rootId:    string,
  personMap: Map<string, DbPerson>,
  families:  DbFamily[]
): TreeCard[] {
  const cards   = new Array<TreeCard>();
  const placed  = new Set<string>();

  // person → families where they appear as husband or wife
  const famMap = new Map<string, DbFamily[]>();
  for (const fam of families) {
    if (fam.husband_id) {
      if (!famMap.has(fam.husband_id)) famMap.set(fam.husband_id, []);
      famMap.get(fam.husband_id)!.push(fam);
    }
    if (fam.wife_id) {
      if (!famMap.has(fam.wife_id)) famMap.set(fam.wife_id, []);
      famMap.get(fam.wife_id)!.push(fam);
    }
  } // end for families

  function getSpouseId(pid: string, fam: DbFamily): string | null {
    if (fam.husband_id === pid) return fam.wife_id || null;
    if (fam.wife_id    === pid) return fam.husband_id || null;
    return null;
  } // end getSpouseId

  function coupleW(pid: string): number {
    const fam = (famMap.get(pid) || [])[0];
    if (!fam) return CARD_W + H_GAP;
    return getSpouseId(pid, fam)
      ? CARD_W + SPOUSE_GAP + CARD_W + H_GAP
      : CARD_W + H_GAP;
  } // end coupleW

  function subtreeW(pid: string): number {
    const fams     = famMap.get(pid) || [];
    const children = fams.flatMap(f => f.children_ids);
    if (!children.length) return coupleW(pid);
    return Math.max(
      children.reduce((s, c) => s + subtreeW(c), 0),
      coupleW(pid)
    );
  } // end subtreeW

  function place(pid: string, cx: number, y: number) {
    if (placed.has(pid)) return;
    placed.add(pid);

    const person = personMap.get(pid);
    if (!person) return;

    const fams    = famMap.get(pid) || [];
    const mainFam = fams[0] || null;
    const spouseId     = mainFam ? getSpouseId(pid, mainFam) : null;
    const spousePerson = spouseId ? (personMap.get(spouseId) || null) : null;
    if (spouseId) placed.add(spouseId);

    const cw   = spouseId ? CARD_W + SPOUSE_GAP + CARD_W : CARD_W;
    const left = cx - cw / 2;

    const allChildren = fams.flatMap(f => f.children_ids);

    cards.push({
      person,
      x:            left,
      y,
      spouseId,
      spousePerson,
      children:     allChildren,
      divorced:     mainFam?.divorced      ?? false,
      marriageDate: mainFam?.marriage_date ?? '',
    });

    if (allChildren.length > 0) {
      const childY = y + CARD_H + V_GAP;
      const totalW = allChildren.reduce((s, c) => s + subtreeW(c), 0);
      let curX     = cx - totalW / 2;
      for (const cid of allChildren) {
        const sw = subtreeW(cid);
        place(cid, curX + sw / 2, childY);
        curX += sw;
      }
    }
  } // end place

  place(rootId, 0, 0);
  return cards;
} // end buildLayout

// ── Person card SVG ───────────────────────────────────────────────

function PersonCard({ person, x, y, isRoot, onClick, photoUrl, lang }: {
  person:   DbPerson;
  x: number; y: number;
  isRoot:   boolean;
  onClick:  () => void;
  photoUrl?: string;
  lang:     Lang;
}) {
  const lastHe = person.last_name_he || person.birth_last_name_he || '';
  const lastEn = person.last_name_en || person.birth_last_name_en || '';
  const he    = `${person.first_name_he || ''} ${lastHe}`.trim();
  const en    = `${person.first_name_en || ''} ${lastEn}`.trim();
  const line1 = lang === 'he' ? (he || en || '—')
              : lang === 'en' ? (en || he || '—')
              : (he || en || '—');
  const line2 = lang === 'all' && he && en ? en : '';
  const bg     = person.sex === 'M' ? '#dbeafe' : person.sex === 'F' ? '#fce7f3' : '#f1f5f9';
  const accent = person.sex === 'M' ? '#2563eb' : person.sex === 'F' ? '#db2877' : '#94a3b8';
  const PW     = 50;
  const TX     = photoUrl ? PW + 10 : 10;
  const maxCh  = photoUrl ? 11 : 20;
  // clipPath id uses x,y to be unique per card instance
  const clipId = `card-clip-${person.id}`;

  return (
    <g transform={`translate(${x},${y})`} onClick={onClick}
      style={{ cursor: 'pointer' }}>
      {/* Define clipPath LOCAL to this card — clips photo to rounded rect */}
      <defs>
        <clipPath id={clipId}>
          <rect width={PW + 4} height={CARD_H} rx={8} />
        </clipPath>
      </defs>

      {isRoot && (
        <rect x={2} y={3} width={CARD_W} height={CARD_H} rx={8}
          fill="#1e3a5f" opacity={0.15} />
      )}
      <rect width={CARD_W} height={CARD_H} rx={8}
        fill={bg} stroke={isRoot ? '#1e3a5f' : accent}
        strokeWidth={isRoot ? 2.5 : 1} />

      {photoUrl && (
        <g clipPath={`url(#${clipId})`}>
          <image href={photoUrl} x={4} y={0} width={PW} height={CARD_H}
            preserveAspectRatio="xMidYMid slice" />
        </g>
      )}

      <rect x={0} y={0} width={4} height={CARD_H} fill={accent} />

      {photoUrl ? (
        <>
          <text x={TX} y={22} fontSize={10} textAnchor="start"
            fontWeight={isRoot ? 'bold' : '500'}
            fill="#1e3a5f" fontFamily="system-ui,sans-serif">
            {line1.length > maxCh ? line1.slice(0, maxCh - 1) + '…' : line1}
          </text>
          {line2 && (
            <text x={TX} y={34} fontSize={9} textAnchor="start"
              fill="#475569" fontFamily="system-ui,sans-serif">
              {line2.length > maxCh + 2 ? line2.slice(0, maxCh + 1) + '…' : line2}
            </text>
          )}
          {person.birth_date && (
            <text x={TX} y={line2 ? 48 : 38} fontSize={9} textAnchor="start"
              fill="#64748b" fontFamily="system-ui,sans-serif">
              b. {person.birth_date}
            </text>
          )}
          {person.death_date && (
            <text x={TX} y={line2 ? 60 : 50} fontSize={9} textAnchor="start"
              fill="#64748b" fontFamily="system-ui,sans-serif">
              ✝ {person.death_date}
            </text>
          )}
        </>
      ) : (
        <>
          <text x={CARD_W / 2} y={22} fontSize={10} textAnchor="middle"
            fontWeight={isRoot ? 'bold' : '500'}
            fill="#1e3a5f" fontFamily="system-ui,sans-serif">
            {line1.length > 20 ? line1.slice(0, 19) + '…' : line1}
          </text>
          {line2 && (
            <text x={CARD_W / 2} y={34} fontSize={9} textAnchor="middle"
              fill="#475569" fontFamily="system-ui,sans-serif">
              {line2.length > 22 ? line2.slice(0, 21) + '…' : line2}
            </text>
          )}
          {person.birth_date && (
            <text x={CARD_W / 2} y={line2 ? 48 : 38} fontSize={9} textAnchor="middle"
              fill="#64748b" fontFamily="system-ui,sans-serif">
              b. {person.birth_date}
            </text>
          )}
          {person.death_date && (
            <text x={CARD_W / 2} y={line2 ? 60 : 50} fontSize={9} textAnchor="middle"
              fill="#64748b" fontFamily="system-ui,sans-serif">
              ✝ {person.death_date}
            </text>
          )}
        </>
      )}
      <rect width={CARD_W} height={CARD_H} rx={8} fill="transparent" />
    </g>
  );
} // end PersonCard

// ── Main page ─────────────────────────────────────────────────────

export default function TreePage() {
  const searchParams = useSearchParams();
  const routerNav    = useRouter();
  const rootParam    = searchParams.get('root');

  const [persons,  setPersons]  = useState<DbPerson[]>([]);
  const [families, setFamilies] = useState<DbFamily[]>([]);
  const [rootId,   setRootId]   = useState<string>(rootParam || '');
  const [cards,    setCards]    = useState<TreeCard[]>([]);
  const photosRef  = useRef<Map<string, string>>(new Map());
  const [photosTick, setPhotosTick] = useState(0); // increment to trigger re-render
  const [loading,  setLoading]  = useState(true);
  const [lang,     setLang]     = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('preferred_lang') as Lang) || 'he';
    }
    return 'he';
  });
  const [error,    setError]    = useState('');

  const [pan,      setPan]      = useState({ x: 500, y: 120 });
  const [zoom,     setZoom]     = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ x: 0, y: 0, px: 500, py: 120 });

  // ── Load data ───────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [pr, fr] = await Promise.all([
          fetch('/api/persons'),
          fetch('/api/families'),
        ]);
        const pd = await pr.json();
        const fd = await fr.json();
        if (!pr.ok) throw new Error(pd.error);
        if (!fr.ok) throw new Error(fd.error);
        setPersons(pd.persons);
        setFamilies(fd.families);

        let root = rootParam || localStorage.getItem('default_root_id') || '';
        if (!root || !pd.persons.find((p: DbPerson) => p.id === root)) {
          root = pd.persons[0]?.id || '';
        }
        setRootId(root);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // end useEffect load

  // ── Build layout ────────────────────────────────────────────────
  useEffect(() => {
    if (!rootId || !persons.length) return;
    const pMap     = new Map(persons.map(p => [p.id, p]));
    const newCards = buildLayout(rootId, pMap, families);
    setCards(newCards);
    setPan({ x: window.innerWidth / 2, y: 140 });
    setZoom(1);
  }, [rootId, persons, families]); // end useEffect layout

  // ── Load photos ─────────────────────────────────────────────────
  useEffect(() => {
    if (!cards.length) return;
    const ids = new Set<string>();
    cards.forEach(c => {
      ids.add(c.person.id);
      if (c.spouseId) ids.add(c.spouseId);
    });
    const toLoad = Array.from(ids);
    async function loadPhotos() {
    // Load in batches of 10 to avoid too many parallel requests
    const batchSize = 10;
    for (let i = 0; i < toLoad.length; i += batchSize) {
      const batch = toLoad.slice(i, i + batchSize);
      await Promise.all(batch.map(async id => {
        if (photosRef.current.has(id)) return;
        try {
          const res = await fetch(`/api/photos/${id}`);
          const d   = await res.json();
          if (d.exists && d.url) {
            photosRef.current.set(id, d.url);
          }
        } catch {}
      }));
      // Re-render after each batch so photos appear progressively
      setPhotosTick(t => t + 1);
    }
    } // end loadPhotos
    loadPhotos();
  }, [cards]); // end useEffect photos

  // ── Pan / zoom ──────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    setDragging(true);
    dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    });
  }
  function onMouseUp() { setDragging(false); }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom(z => Math.min(3, Math.max(0.15, z * (e.deltaY < 0 ? 1.12 : 0.9))));
  }
  function resetView() {
    setPan({ x: window.innerWidth / 2, y: 140 });
    setZoom(1);
  }

  if (loading) return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-blue-600 animate-pulse text-lg">Loading family tree…</p>
    </main>
  );
  if (error) return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-red-500">{error}</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-gray-100 flex flex-col select-none">

      {/* Top bar */}
      <div className="bg-blue-900 text-white px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href="/" className="text-sm hover:opacity-80 mr-2">← Back</Link>
        <span className="text-lg font-bold">🌳 Family Tree</span>
        <select value={rootId} onChange={e => setRootId(e.target.value)}
          className="ml-2 bg-blue-800 text-white text-sm rounded-lg px-3 py-1.5
            border border-blue-600 focus:outline-none flex-1 max-w-xs">
          {persons.map(p => {
            const lastHe = p.last_name_he || p.birth_last_name_he || '';
          const lastEn = p.last_name_en || p.birth_last_name_en || '';
          const name = lang === 'en'
            ? `${p.first_name_en || p.first_name_he || ''} ${lastEn || lastHe}`.trim()
            : `${p.first_name_he || p.first_name_en || ''} ${lastHe || lastEn}`.trim();
            const year = p.birth_date?.split(' ').pop() || '';
            return <option key={p.id} value={p.id}>{name}{year ? ` (${year})` : ''}</option>;
          })}
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={resetView}
            className="bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm">
            🎯 Center
          </button>
          {/* Language toggle */}
          {(['he', 'en', 'all'] as Lang[]).map(l => (
            <button key={l} onClick={() => {
              setLang(l);
              localStorage.setItem('preferred_lang', l);
            }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium
                ${lang === l ? 'bg-white text-blue-900' : 'bg-blue-700 hover:bg-blue-600'}`}>
              {l === 'he' ? '🇮🇱' : l === 'en' ? '🇬🇧' : '🌐'}
            </button>
          ))}
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))}
            className="bg-blue-700 hover:bg-blue-600 w-8 h-8 rounded-lg text-lg font-bold
              flex items-center justify-center">+</button>
          <button onClick={() => setZoom(z => Math.max(0.15, z * 0.85))}
            className="bg-blue-700 hover:bg-blue-600 w-8 h-8 rounded-lg text-lg font-bold
              flex items-center justify-center">−</button>
          <span className="text-xs opacity-60 w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Hint */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-1 text-xs text-blue-500 flex-shrink-0">
        🖱 Drag to pan · Scroll to zoom · Click a card to open profile
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden relative"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}>

        <svg width="100%" height="100%" overflow="visible">

          {/* ── Connector lines — rendered FIRST (behind cards) ── */}
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {cards.map(card => {
              // Parent connector drops from midpoint of marriage line gap
              // For couple: gap is between (card.x + CARD_W) and (card.x + CARD_W + SPOUSE_GAP)
              // Midpoint = card.x + CARD_W + SPOUSE_GAP/2
              // For single: center of card = card.x + CARD_W/2
              const dropX  = card.spouseId
                ? card.x + CARD_W + SPOUSE_GAP / 2
                : card.x + CARD_W / 2;
              const dropY  = card.y + CARD_H;

              return card.children.map(childId => {
                const child = cards.find(c => c.person.id === childId);
                if (!child) return null;
                // Child connector attaches to center of child's person card (not couple)
                const childX = child.x + CARD_W / 2;
                const childY = child.y;
                const midY   = dropY + (childY - dropY) / 2;

                return (
                  <path key={`conn-${card.person.id}-${childId}`}
                    d={`M${dropX},${dropY} V${midY} H${childX} V${childY}`}
                    fill="none" stroke="#94a3b8" strokeWidth={1.5} />
                );
              });
            })}
          </g>

          {/* ── Marriage lines — rendered SECOND ── */}
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {cards.filter(c => c.spouseId).map(card => {
              const x1   = card.x + CARD_W;           // right edge of person card
              const x2   = card.x + CARD_W + SPOUSE_GAP; // left edge of spouse card
              const midX = (x1 + x2) / 2;
              const lineY = card.y + CARD_H / 2;

              return (
                <g key={`marr-${card.person.id}`}>
                  {/* Marriage date above the couple */}
                  {card.marriageDate && (
                    <text x={midX} y={card.y - 5}
                      textAnchor="middle" fontSize={8} fill="#64748b"
                      fontFamily="system-ui,sans-serif">
                      {card.marriageDate}
                    </text>
                  )}
                  {/* Horizontal marriage line */}
                  <line x1={x1} y1={lineY} x2={x2} y2={lineY}
                    stroke={card.divorced ? '#94a3b8' : '#374151'}
                    strokeWidth={2}
                    strokeDasharray={card.divorced ? '4,3' : undefined} />
                  {/* Vertical stem from marriage line down to card bottom */}
                  <line x1={midX} y1={lineY} x2={midX} y2={card.y + CARD_H}
                    stroke="#94a3b8" strokeWidth={1.5} />
                </g>
              );
            })}
          </g>

          {/* ── Person cards — rendered LAST (on top) ── */}
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {cards.map(card => (
              <g key={`cards-${card.person.id}`}>
                <PersonCard
                  person={card.person}
                  x={card.x} y={card.y}
                  isRoot={card.person.id === rootId}
                  photoUrl={photosRef.current.get(card.person.id)}
                  lang={lang}
                  onClick={() => routerNav.push(`/person/${card.person.id}`)}
                />
                {card.spouseId && card.spousePerson && (
                  <PersonCard
                    person={card.spousePerson}
                    x={card.x + CARD_W + SPOUSE_GAP}
                    y={card.y}
                    isRoot={card.spouseId === rootId}
                    photoUrl={photosRef.current.get(card.spouseId!)}
                  lang={lang}
                    onClick={() => routerNav.push(`/person/${card.spouseId}`)}
                  />
                )}
              </g>
            ))}
          </g>

        </svg>

      </div>

      {/* Footer */}
      <div className="bg-white border-t px-6 py-2 text-xs text-gray-400 flex gap-4 flex-shrink-0">
        <span>{persons.length} people</span>
        <span>{families.length} families</span>
        <span>{cards.length} nodes shown</span>
      </div>

    </main>
  );
} // end TreePage
