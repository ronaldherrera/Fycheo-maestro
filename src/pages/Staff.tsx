import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MAILBOXES } from '../lib/mailboxes';
import {
  UserPlus, Shield, Headphones, Eye, Crown,
  MoreVertical, Pencil, Trash2, X, Check,
  LayoutDashboard, Building2, Users, Mail,
  Sparkles, MessageSquare, Lock, Inbox, LifeBuoy,
} from 'lucide-react';

type Role = 'supermaestro' | 'admin' | 'support' | 'viewer';

interface StaffMember {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: Role;
  permissions: {
    screens?: string[];
    mailboxes?: string[];
    [key: string]: any;
  };
  avatar_url: string | null;
  active: boolean;
  created_at: string;
}

const ROLE_META: Record<Role, { label: string; color: string; bg: string; icon: any }> = {
  supermaestro: { label: 'Supermaestro', color: '#a78bfa', bg: 'rgba(139,92,246,0.15)', icon: Crown },
  admin:        { label: 'Administrador', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', icon: Shield },
  support:      { label: 'Soporte',       color: '#34d399', bg: 'rgba(16,185,129,0.15)', icon: Headphones },
  viewer:       { label: 'Visor',         color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', icon: Eye },
};

const ALL_SCREENS = [
  { id: 'dashboard', label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'companies', label: 'Empresas',        icon: Building2 },
  { id: 'employees', label: 'Empleados',       icon: Users },
  { id: 'emails',    label: 'Correos',         icon: Mail },
  { id: 'demos',     label: 'Demo',            icon: Sparkles },
  { id: 'contacts',  label: 'Solicitudes',     icon: MessageSquare },
  { id: 'support',   label: 'Soporte',         icon: LifeBuoy },
  { id: 'staff',     label: 'Equipo Fycheo',   icon: Crown },
];

const emptyForm = {
  name: '',
  email: '',
  role: 'support' as Role,
  screens: [] as string[],
  mailboxes: [] as string[],
};

export function Staff() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_all_maestro_staff');
    if (!error && data) setMembers(data);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const openCreate = () => {
    setEditMember(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (m: StaffMember) => {
    setEditMember(m);
    setForm({
      name: m.name,
      email: m.email,
      role: m.role,
      screens: m.permissions?.screens ?? [],
      mailboxes: m.permissions?.mailboxes ?? [],
    });
    setError('');
    setShowModal(true);
    setOpenMenu(null);
  };

  const toggleScreen = (id: string) => {
    setForm(f => ({
      ...f,
      screens: f.screens.includes(id)
        ? f.screens.filter(s => s !== id)
        : [...f.screens, id],
    }));
  };

  const toggleMailbox = (email: string) => {
    setForm(f => ({
      ...f,
      mailboxes: f.mailboxes.includes(email)
        ? f.mailboxes.filter(m => m !== email)
        : [...f.mailboxes, email],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios.');
      return;
    }
    setSaving(true);
    setError('');

    if (editMember) {
      const { error } = await supabase.rpc('update_maestro_staff', {
        p_id: editMember.id,
        p_name: form.name,
        p_email: form.email,
        p_role: form.role,
        p_active: editMember.active,
        p_permissions: { screens: form.screens, mailboxes: form.mailboxes },
      });
      if (error) setError(error.message);
      else { setShowModal(false); fetchStaff(); }
    } else {
      const { error } = await supabase.rpc('insert_maestro_staff', {
        p_name: form.name,
        p_email: form.email,
        p_role: form.role,
        p_permissions: { screens: form.screens, mailboxes: form.mailboxes },
      });
      if (error) setError(error.message);
      else { setShowModal(false); fetchStaff(); }
    }
    setSaving(false);
  };

  const toggleActive = async (m: StaffMember) => {
    await supabase.rpc('update_maestro_staff', {
      p_id: m.id, p_name: m.name, p_email: m.email,
      p_role: m.role, p_active: !m.active,
    });
    setOpenMenu(null);
    fetchStaff();
  };

  const handleDelete = async (m: StaffMember) => {
    if (!confirm(`¿Eliminar a ${m.name} del equipo?`)) return;
    await supabase.rpc('delete_maestro_staff', { p_id: m.id });
    setOpenMenu(null);
    fetchStaff();
  };

  const getInitials = (name: string) =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const isSupermaestro = (m: StaffMember) => m.role === 'supermaestro';
  const hasAllScreens  = (m: StaffMember) => !m.permissions?.screens || m.permissions.screens.length === 0;
  const hasAllMboxes   = (m: StaffMember) => !m.permissions?.mailboxes || m.permissions.mailboxes.length === 0;

  return (
    <div style={{ padding: '2rem', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
            Equipo Fycheo
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Trabajadores con acceso a Fycheo Maestro
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.625rem 1.25rem',
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
            border: 'none', borderRadius: 10, color: 'white',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 0 16px rgba(139,92,246,0.3)',
          }}
        >
          <UserPlus size={16} />
          Añadir miembro
        </button>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {members.map(m => {
            const meta = ROLE_META[m.role];
            const Icon = meta.icon;
            const screens  = m.permissions?.screens   ?? [];
            const mailboxes = m.permissions?.mailboxes ?? [];
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '0.875rem',
                  background: 'rgba(21,27,43,0.5)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14, padding: '1rem 1.25rem',
                  opacity: m.active ? 1 : 0.5,
                  position: 'relative',
                }}
              >
                {/* Fila principal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: meta.bg, border: `1px solid ${meta.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.875rem', fontWeight: 700, color: meta.color,
                  }}>
                    {getInitials(m.name)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{m.name}</span>
                      {!m.active && (
                        <span style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '0.1rem 0.5rem', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                          Inactivo
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.email}</span>
                  </div>

                  {/* Role badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    background: meta.bg, borderRadius: 8,
                    border: `1px solid ${meta.color}30`,
                  }}>
                    <Icon size={13} color={meta.color} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: meta.color }}>{meta.label}</span>
                  </div>

                  {/* Connected indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 90 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: m.user_id ? '#10b981' : '#6b7280',
                      boxShadow: m.user_id ? '0 0 6px #10b981' : 'none',
                    }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {m.user_id ? 'Vinculado' : 'Sin vincular'}
                    </span>
                  </div>

                  {/* Menu */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 6 }}
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === m.id && (
                      <div style={{
                        position: 'absolute', right: 0, top: '110%', zIndex: 50,
                        background: '#1a2035', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, minWidth: 160, overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                      }}>
                        <button onClick={() => openEdit(m)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.625rem 1rem', background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>
                          <Pencil size={14} /> Editar
                        </button>
                        <button onClick={() => toggleActive(m)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.625rem 1rem', background: 'none', border: 'none', color: m.active ? '#f59e0b' : '#10b981', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>
                          {m.active ? <X size={14} /> : <Check size={14} />}
                          {m.active ? 'Desactivar' : 'Activar'}
                        </button>
                        {!isSupermaestro(m) && (
                          <button onClick={() => handleDelete(m)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.625rem 1rem', background: 'none', border: 'none', color: '#f87171', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>
                            <Trash2 size={14} /> Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fila de permisos (solo si no es supermaestro) */}
                {!isSupermaestro(m) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.25rem' }}>
                      <Lock size={11} color="var(--text-darker)" />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-darker)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acceso:</span>
                    </div>

                    {/* Pantallas */}
                    {hasAllScreens(m) ? (
                      <span style={chipStyle('#8b5cf6')}>Todas las pantallas</span>
                    ) : (
                      screens.map(sid => {
                        const scr = ALL_SCREENS.find(s => s.id === sid);
                        return scr ? <span key={sid} style={chipStyle('#8b5cf6')}>{scr.label}</span> : null;
                      })
                    )}

                    <span style={{ margin: '0 0.25rem', color: 'var(--text-darker)', fontSize: '0.75rem' }}>·</span>

                    {/* Buzones */}
                    {hasAllMboxes(m) ? (
                      <span style={chipStyle('#3b82f6')}>Todos los buzones</span>
                    ) : (
                      mailboxes.map(em => {
                        const mb = MAILBOXES.find(x => x.email === em);
                        return mb ? <span key={em} style={chipStyle(mb.color)}>{mb.displayName}</span> : null;
                      })
                    )}
                  </div>
                )}

                {isSupermaestro(m) && (
                  <div style={{ paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={chipStyle('#a78bfa')}>Acceso total — Supermaestro</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }} onClick={() => setShowModal(false)}>
          <div
            style={{
              background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 18, padding: '2rem', width: '100%', maxWidth: 520,
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-main)', marginBottom: '1.5rem' }}>
              {editMember ? 'Editar miembro' : 'Nuevo miembro del equipo'}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Nombre y correo */}
              {[
                { label: 'Nombre completo', key: 'name', type: 'text', placeholder: 'Ej. Ana García' },
                { label: 'Correo electrónico', key: 'email', type: 'email', placeholder: 'ana@fycheo.es' },
              ].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                </div>
              ))}

              {/* Rol */}
              <div>
                <label style={labelStyle}>Categoría</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {(Object.entries(ROLE_META) as [Role, typeof ROLE_META[Role]][]).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </select>
              </div>

              {/* ── PANTALLAS ── */}
              <div>
                <label style={labelStyle}>
                  <Lock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Pantallas con acceso
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)', fontWeight: 400, marginLeft: 6, textTransform: 'none' }}>
                    (vacío = todas)
                  </span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {ALL_SCREENS.map(s => {
                    const active = form.screens.includes(s.id);
                    const SIcon = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleScreen(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.35rem 0.7rem',
                          background: active ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 8, cursor: 'pointer',
                          color: active ? '#c4b5fd' : 'var(--text-muted)',
                          fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        <SIcon size={12} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── BUZONES ── */}
              <div>
                <label style={labelStyle}>
                  <Inbox size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Buzones de correo con acceso
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)', fontWeight: 400, marginLeft: 6, textTransform: 'none' }}>
                    (vacío = todos)
                  </span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {MAILBOXES.map(mb => {
                    const active = form.mailboxes.includes(mb.email);
                    return (
                      <button
                        key={mb.email}
                        type="button"
                        onClick={() => toggleMailbox(mb.email)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.35rem',
                          padding: '0.35rem 0.7rem',
                          background: active ? `${mb.color}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${active ? `${mb.color}55` : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 8, cursor: 'pointer',
                          color: active ? mb.color : 'var(--text-muted)',
                          fontSize: '0.8rem', fontWeight: active ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? mb.color : 'var(--text-darker)', flexShrink: 0 }} />
                        {mb.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '0.6rem 0.875rem', color: '#f87171', fontSize: '0.84rem' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', borderRadius: 9, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Guardando...' : editMember ? 'Guardar cambios' : 'Añadir miembro'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── helpers de estilo ── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', fontWeight: 600,
  color: 'var(--text-muted)', marginBottom: '0.4rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.7rem 0.875rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 9, color: 'var(--text-main)',
  fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
};

function chipStyle(color: string): React.CSSProperties {
  return {
    fontSize: '0.72rem', fontWeight: 600,
    padding: '0.2rem 0.55rem', borderRadius: 6,
    background: `${color}1a`,
    border: `1px solid ${color}40`,
    color: color,
  };
}
