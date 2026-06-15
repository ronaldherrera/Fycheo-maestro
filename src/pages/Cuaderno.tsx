import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Trash2, Search, ExternalLink, CheckSquare,
  Square, FileText, Bell, Building2, User, RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type NoteType = 'nota' | 'tarea' | 'recordatorio';

interface Note {
  id: string;
  type: NoteType;
  content: string;
  done: boolean;
  date?: string;
  created_at: number;
}

interface Enlace {
  id: string;
  title: string;
  url: string;
  description?: string;
  ogImage?: string;
  created_at: number;
}

interface Company {
  id: string;
  name: string;
  plan: string;
  sector?: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  profile_type?: string;
  created_at: string;
}

// ── localStorage helpers ─────────────────────────────────────────────────────

const loadNotes   = (): Note[]   => JSON.parse(localStorage.getItem('cuaderno_notas')   ?? '[]');
const saveNotes   = (n: Note[])  => localStorage.setItem('cuaderno_notas',   JSON.stringify(n));
const loadEnlaces = (): Enlace[] => JSON.parse(localStorage.getItem('cuaderno_enlaces') ?? '[]');
const saveEnlaces = (e: Enlace[]) => localStorage.setItem('cuaderno_enlaces', JSON.stringify(e));

// ── Styles ───────────────────────────────────────────────────────────────────

const TAB_STYLE = (active: boolean): React.CSSProperties => ({
  padding: '6px 16px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  border: 'none', transition: 'all 0.15s',
  background: active ? 'var(--accent)' : 'transparent',
  color:      active ? '#fff'          : 'var(--text-darker)',
});

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-alt)', border: '1px solid var(--border-color)',
  borderRadius: 8, padding: '8px 12px', color: 'var(--text-main)', fontSize: '0.82rem',
  outline: 'none', width: '100%',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
};

const btnDanger: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer',
  padding: '4px', borderRadius: 6, display: 'flex', alignItems: 'center',
};

// ── Main component ───────────────────────────────────────────────────────────

interface CuadernoProps {
  section?: 'notas' | 'agenda' | 'enlaces';
  onSectionChange?: (s: 'notas' | 'agenda' | 'enlaces') => void;
}

export const Cuaderno: React.FC<CuadernoProps> = ({ section: sectionProp = 'notas', onSectionChange }) => {
  const [section, setSection] = useState<'notas' | 'agenda' | 'enlaces'>(sectionProp);

  React.useEffect(() => { setSection(sectionProp); }, [sectionProp]);

  const changeSection = (s: 'notas' | 'agenda' | 'enlaces') => {
    setSection(s);
    onSectionChange?.(s);
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <BookOpen size={20} color="var(--accent)" />
        <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>Cuaderno</h1>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', background: 'var(--surface-alt)', borderRadius: 10, padding: 4 }}>
          {(['notas', 'agenda', 'enlaces'] as const).map(s => (
            <button key={s} style={TAB_STYLE(section === s)} onClick={() => changeSection(s)}>
              {s === 'notas' ? 'Notas y tareas' : s === 'agenda' ? 'Agenda' : 'Enlaces'}
            </button>
          ))}
        </div>
      </div>

      {section === 'notas'   && <NotasSection />}
      {section === 'agenda'  && <AgendaSection />}
      {section === 'enlaces' && <EnlacesSection />}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// NOTAS & TAREAS
// ══════════════════════════════════════════════════════════════════════════════

const NOTE_COLORS: Record<NoteType, string> = {
  nota: '#3b82f6', tarea: '#8b5cf6', recordatorio: '#f59e0b',
};

const NOTE_LABELS: Record<NoteType, string> = {
  nota: 'Nota', tarea: 'Tarea', recordatorio: 'Recordatorio',
};

const NotasSection: React.FC = () => {
  const [notes, setNotes]     = useState<Note[]>(loadNotes);
  const [content, setContent] = useState('');
  const [type, setType]       = useState<NoteType>('nota');
  const [date, setDate]       = useState('');
  const [filter, setFilter]   = useState<NoteType | 'todas'>('todas');

  const persist = (updated: Note[]) => { setNotes(updated); saveNotes(updated); };

  const add = () => {
    if (!content.trim()) return;
    const n: Note = { id: crypto.randomUUID(), type, content: content.trim(), done: false, date: date || undefined, created_at: Date.now() };
    persist([n, ...notes]);
    setContent(''); setDate('');
  };

  const toggle = (id: string) => persist(notes.map(n => n.id === id ? { ...n, done: !n.done } : n));
  const remove = (id: string) => persist(notes.filter(n => n.id !== id));

  const visible = filter === 'todas' ? notes : notes.filter(n => n.type === filter);
  const pending = notes.filter(n => n.type === 'tarea' && !n.done).length;

  return (
    <div>
      {/* Quick add */}
      <div className="gc" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['nota', 'tarea', 'recordatorio'] as NoteType[]).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${type === t ? NOTE_COLORS[t] : 'var(--border-color)'}`,
              background: type === t ? `${NOTE_COLORS[t]}22` : 'transparent',
              color: type === t ? NOTE_COLORS[t] : 'var(--text-darker)',
            }}>{NOTE_LABELS[t]}</button>
          ))}
          {type === 'recordatorio' && (
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, width: 'auto', padding: '4px 10px', marginLeft: 'auto' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={type === 'tarea' ? 'Nueva tarea...' : type === 'recordatorio' ? 'Nuevo recordatorio...' : 'Nueva nota...'}
            rows={2} style={{ ...inputStyle, resize: 'none', flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) add(); }}
          />
          <button onClick={add} style={{ ...btnPrimary, alignSelf: 'flex-end' }}>
            <Plus size={14} /> Añadir
          </button>
        </div>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-darker)', marginTop: 6 }}>Ctrl+Enter para añadir rápido</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
        {(['todas', 'nota', 'tarea', 'recordatorio'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: filter === f ? 'var(--surface-alt)' : 'transparent',
            color: filter === f ? 'var(--text-main)' : 'var(--text-darker)',
          }}>
            {f === 'todas' ? 'Todas' : NOTE_LABELS[f]}
            {f === 'tarea' && pending > 0 && (
              <span style={{ marginLeft: 4, background: '#8b5cf6', color: '#fff', borderRadius: 99, padding: '0 5px', fontSize: '0.62rem' }}>{pending}</span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-darker)' }}>{visible.length} elemento{visible.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.length === 0 && (
          <div className="gc" style={{ padding: 24, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>
            Sin {filter === 'todas' ? 'elementos' : NOTE_LABELS[filter as NoteType].toLowerCase() + 's'} aún
          </div>
        )}
        {visible.map(n => (
          <div key={n.id} className="gc" style={{ padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', opacity: n.done ? 0.55 : 1 }}>
            {n.type === 'tarea' ? (
              <button onClick={() => toggle(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: n.done ? '#8b5cf6' : 'var(--text-darker)', marginTop: 1, padding: 0 }}>
                {n.done ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            ) : n.type === 'recordatorio' ? (
              <Bell size={14} style={{ color: NOTE_COLORS.recordatorio, marginTop: 2, flexShrink: 0 }} />
            ) : (
              <FileText size={14} style={{ color: NOTE_COLORS.nota, marginTop: 2, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', textDecoration: n.done ? 'line-through' : 'none', marginBottom: n.date ? 4 : 0 }}>{n.content}</p>
              {n.date && <p style={{ fontSize: '0.67rem', color: NOTE_COLORS.recordatorio }}>{new Date(n.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>}
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: NOTE_COLORS[n.type], background: `${NOTE_COLORS[n.type]}18`, borderRadius: 6, padding: '2px 7px' }}>{NOTE_LABELS[n.type]}</span>
            <button onClick={() => remove(n.id)} style={btnDanger}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// AGENDA
// ══════════════════════════════════════════════════════════════════════════════

const PLAN_COLOR: Record<string, string> = {
  basic: '#3b82f6', pro: '#8b5cf6', ultimate: '#f59e0b', free: '#6b7280',
};

const ORG_COLOR  = '#10b981';
const USER_COLOR = '#8b5cf6';

const ProfileRow: React.FC<{ p: Profile; color: string }> = ({ p, color }) => (
  <div className="gc" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <User size={15} color={color} />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{p.full_name ?? '—'}</p>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</p>
    </div>
    {p.phone && <span style={{ fontSize: '0.68rem', color: 'var(--text-darker)', flexShrink: 0 }}>{p.phone}</span>}
    {p.profile_type && (
      <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize', color, background: `${color}18`, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>{p.profile_type}</span>
    )}
    <span style={{ fontSize: '0.65rem', color: 'var(--text-darker)', flexShrink: 0 }}>{new Date(p.created_at).toLocaleDateString('es-ES')}</span>
  </div>
);

const AgendaSection: React.FC = () => {
  const [tab, setTab]             = useState<'cuentas' | 'organizaciones' | 'usuarios'>('cuentas');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles]   = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: co }, { data: pr }] = await Promise.all([
      supabase.from('companies').select('id,name,plan,sector,created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id,full_name,email,phone,profile_type,created_at').order('created_at', { ascending: false }),
    ]);
    setCompanies(co ?? []);
    setProfiles(pr ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const q          = search.toLowerCase();
  const cuentas    = profiles.filter(p => p.profile_type != null);
  const matchProf  = (p: Profile) => (p.full_name ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q);
  const filteredCu = cuentas.filter(matchProf);
  const filteredCo = companies.filter(c => c.name.toLowerCase().includes(q) || (c.sector ?? '').toLowerCase().includes(q));
  const filteredUs = profiles.filter(matchProf);

  const TABS = [
    { id: 'cuentas'        as const, label: 'Cuentas',        count: cuentas.length    },
    { id: 'organizaciones' as const, label: 'Organizaciones', count: companies.length  },
    { id: 'usuarios'       as const, label: 'Usuarios',       count: profiles.length   },
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface-alt)', borderRadius: 10, padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} style={TAB_STYLE(tab === t.id)} onClick={() => { setTab(t.id); setSearch(''); }}>
              {t.label} <span style={{ opacity: 0.6 }}>({t.count})</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-darker)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
        <button onClick={load} style={{ ...btnPrimary, background: 'var(--surface-alt)', color: 'var(--text-muted)' }}><RefreshCw size={13} /></button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-darker)', fontSize: '0.82rem' }}>Cargando...</div>
      ) : tab === 'cuentas' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredCu.length === 0 && <div className="gc" style={{ padding: 24, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>Sin cuentas</div>}
          {filteredCu.map(p => <ProfileRow key={p.id} p={p} color="#3b82f6" />)}
        </div>
      ) : tab === 'organizaciones' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredCo.length === 0 && <div className="gc" style={{ padding: 24, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>Sin organizaciones</div>}
          {filteredCo.map(c => (
            <div key={c.id} className="gc" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: `${PLAN_COLOR[c.plan] ?? '#6b7280'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={15} color={PLAN_COLOR[c.plan] ?? '#6b7280'} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>{c.name}</p>
                {c.sector && <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)' }}>{c.sector}</p>}
              </div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: PLAN_COLOR[c.plan] ?? '#6b7280', background: `${PLAN_COLOR[c.plan] ?? '#6b7280'}18`, borderRadius: 6, padding: '2px 8px' }}>{c.plan}</span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-darker)' }}>{new Date(c.created_at).toLocaleDateString('es-ES')}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filteredUs.length === 0 && <div className="gc" style={{ padding: 24, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>Sin usuarios</div>}
          {filteredUs.map(p => <ProfileRow key={p.id} p={p} color={USER_COLOR} />)}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ENLACES
// ══════════════════════════════════════════════════════════════════════════════

const getDomain = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };
const faviconUrl = (url: string) => `https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=64`;

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    const j = await r.json();
    return j?.data?.image?.url ?? j?.data?.screenshot?.url ?? null;
  } catch { return null; }
}

const LinkCard: React.FC<{ e: Enlace; onRemove: () => void; onOgFetched: (id: string, img: string) => void }> = ({ e, onRemove, onOgFetched }) => {
  const [ogImage, setOgImage] = useState<string | null>(e.ogImage ?? null);
  const [imgOk, setImgOk]     = useState(true);

  useEffect(() => {
    if (e.ogImage) return;
    fetchOgImage(e.url).then(img => {
      if (img) { setOgImage(img); onOgFetched(e.id, img); }
    });
  }, [e.id, e.url, e.ogImage, onOgFetched]);

  const domain = getDomain(e.url);
  const showPreview = ogImage && imgOk;

  return (
    <div className="gc" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10 }}>
      {/* Preview area */}
      {showPreview ? (
        <div style={{ height: 130, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
          <img
            src={ogImage!}
            alt=""
            onError={() => setImgOk(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(10,13,25,0.7) 100%)' }} />
        </div>
      ) : (
        <div style={{ height: 130, background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={faviconUrl(e.url)} alt="" width={40} height={40} style={{ borderRadius: 8, imageRendering: 'crisp-edges' }}
            onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}

      {/* Info */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={faviconUrl(e.url)} alt="" width={16} height={16} style={{ borderRadius: 3, flexShrink: 0 }}
            onError={ev => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{e.title}</p>
          <button onClick={onRemove} style={btnDanger}><Trash2 size={13} /></button>
        </div>
        <p style={{ fontSize: '0.63rem', color: 'var(--text-darker)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{domain}</p>
        {e.description && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{e.description}</p>}
        <a href={e.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600, textDecoration: 'none', marginTop: 'auto', paddingTop: 4 }}>
          <ExternalLink size={11} /> Abrir
        </a>
      </div>
    </div>
  );
};

const EnlacesSection: React.FC = () => {
  const [enlaces, setEnlaces] = useState<Enlace[]>(loadEnlaces);
  const [title, setTitle]     = useState('');
  const [url, setUrl]         = useState('');
  const [desc, setDesc]       = useState('');
  const [search, setSearch]   = useState('');
  const [error, setError]     = useState('');

  const persist = (updated: Enlace[]) => { setEnlaces(updated); saveEnlaces(updated); };

  const add = () => {
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    if (!url.trim())   { setError('La URL es obligatoria.'); return; }
    const safeUrl = url.startsWith('http') ? url : `https://${url}`;
    const e: Enlace = { id: crypto.randomUUID(), title: title.trim(), url: safeUrl, description: desc.trim() || undefined, created_at: Date.now() };
    persist([e, ...enlaces]);
    setTitle(''); setUrl(''); setDesc(''); setError('');
  };

  const remove = (id: string) => persist(enlaces.filter(e => e.id !== id));

  const handleOgFetched = React.useCallback((id: string, ogImage: string) => {
    setEnlaces(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, ogImage } : e);
      saveEnlaces(updated);
      return updated;
    });
  }, []);

  const q = search.toLowerCase();
  const visible = enlaces.filter(e => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q));

  return (
    <div>
      {/* Add form */}
      <div className="gc" style={{ padding: '16px 18px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título *" style={inputStyle} />
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL *  (ej: google.com)" style={inputStyle}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descripción (opcional)" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={add} style={btnPrimary}><Plus size={14} /> Añadir enlace</button>
        </div>
        {error && <p style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 6 }}>{error}</p>}
      </div>

      {/* Search */}
      {enlaces.length > 3 && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-darker)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar enlace..." style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
      )}

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="gc" style={{ padding: 24, textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>
          {enlaces.length === 0 ? 'Añade tus primeros enlaces de interés' : 'Sin resultados'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {visible.map(e => (
            <LinkCard key={e.id} e={e} onRemove={() => remove(e.id)} onOgFetched={handleOgFetched} />
          ))}
        </div>
      )}
    </div>
  );
};
