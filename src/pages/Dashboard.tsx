import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Building2, Users, Clock, RefreshCw, Wallet,
  AlertTriangle, Sparkles,
  ArrowUpRight, ArrowDownLeft, ChevronDown,
} from 'lucide-react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, number> = { free: 0, basic: 29, pro: 49, ultimate: 99, enterprise: 99 };
const PLAN_META: Record<string, { label: string; color: string }> = {
  free:       { label: 'Free',       color: '#6b7280' },
  basic:      { label: 'Básico',     color: '#60a5fa' },
  pro:        { label: 'Pro',        color: '#a78bfa' },
  ultimate:   { label: 'Ultimate',   color: '#f59e0b' },
  enterprise: { label: 'Enterprise', color: '#34d399' },
};
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const planPrice = (plan: string) => PLAN_PRICES[(plan || 'free').toLowerCase()] ?? 0;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Company { id: string; name: string; plan: string; wallet_balance: number; created_at: string; owner_id: string; }
interface OwnerProfile { id: string; full_name: string; wallet_balance: number; }
interface Transaction { id: string; amount: number; amount_gross?: number; type: string; description: string; created_at: string; companies?: { name: string } | null; }

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const Dashboard: React.FC = () => {
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [companies, setCompanies]           = useState<Company[]>([]);
  const [ownerProfiles, setOwnerProfiles]   = useState<OwnerProfile[]>([]);
  const [profilesCount, setProfilesCount]   = useState(0);
  const [fichajesHoy, setFichajesHoy]       = useState(0);
  const [walletTotal, setWalletTotal]       = useState(0);
  const [expandedWallets, setExpandedWallets] = useState<Set<string>>(new Set());
  const [transactions, setTransactions]     = useState<Transaction[]>([]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Primera ronda paralela
      const [
        { data: companiesData },
        { count: profCount },
        { count: fichajesCount },
        { data: txData },
        { data: profilesWallet },
      ] = await Promise.all([
        supabase.from('companies').select('id, name, plan, wallet_balance, created_at, owner_id').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('time_entries').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00Z`),
        supabase.from('transactions').select('id, amount, amount_gross, type, description, created_at, companies(name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('profiles').select('wallet_balance').gt('wallet_balance', 0),
      ]);

      // Segunda ronda: perfiles dueños de empresas con plan de pago (secuencial porque depende de companies)
      const paidOwnerIds = [...new Set(
        (companiesData ?? [])
          .filter(c => (c.plan || 'free') !== 'free' && c.owner_id)
          .map(c => c.owner_id),
      )];

      let ownersData: OwnerProfile[] = [];
      if (paidOwnerIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, wallet_balance')
          .in('id', paidOwnerIds);
        ownersData = data ?? [];
      }

      setCompanies(companiesData ?? []);
      setOwnerProfiles(ownersData);
      setProfilesCount(profCount ?? 0);
      setFichajesHoy(fichajesCount ?? 0);
      setTransactions((txData ?? []) as unknown as Transaction[]);

      const companyWallet  = (companiesData ?? []).reduce((s: number, c: any) => s + (c.wallet_balance ?? 0), 0);
      const personalWallet = (profilesWallet ?? []).reduce((s: number, p: any) => s + (p.wallet_balance ?? 0), 0);
      setWalletTotal(companyWallet + personalWallet);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Derivados ────────────────────────────────────────────────────────────────

  const mrr = useMemo(() =>
    companies.reduce((s, c) => s + planPrice(c.plan), 0),
  [companies]);

  const planDistrib = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of companies) { const p = (c.plan || 'free').toLowerCase(); m[p] = (m[p] ?? 0) + 1; }
    return Object.entries(m)
      .map(([plan, count]) => ({ plan, count, ...(PLAN_META[plan] ?? { label: plan, color: '#6b7280' }) }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  // Agrupa empresas de pago por wallet del propietario y alerta cuando
  // el saldo no cubre un mes completo de los planes contratados.
  const alertasWallet = useMemo(() => {
    const ownerMap = new Map(ownerProfiles.map(p => [p.id, p]));
    const grouped: Record<string, { owner: OwnerProfile; deps: Company[] }> = {};

    for (const c of companies) {
      if ((c.plan || 'free') === 'free') continue;
      const owner = ownerMap.get(c.owner_id);
      if (!owner) continue;
      if (!grouped[owner.id]) grouped[owner.id] = { owner, deps: [] };
      grouped[owner.id].deps.push(c);
    }

    return Object.values(grouped)
      .map(g => ({ ...g, depMrr: g.deps.reduce((s, c) => s + planPrice(c.plan), 0) }))
      .filter(g => (g.owner.wallet_balance ?? 0) < g.depMrr)
      .sort((a, b) => (a.owner.wallet_balance ?? 0) - (b.owner.wallet_balance ?? 0));
  }, [companies, ownerProfiles]);

  const recentCompanies = useMemo(() => companies.slice(0, 5), [companies]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, color: 'var(--text-muted)' }}>
      <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
      <p>Cargando dashboard...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gc { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 14px; }
        .dtr:hover { background: rgba(255,255,255,0.015); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-title)', marginBottom: 4 }}>Dashboard Maestro</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Visión general de toda la plataforma Fycheo.</p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', opacity: refreshing ? 0.5 : 1 }}>
          <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Actualizar
        </button>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        <KpiCard icon={Building2}     color="purple"  label="Organizaciones"   value={companies.length}    sub={`${companies.filter(c => c.plan !== 'free').length} con plan activo`} />
        <KpiCard icon={Users}         color="blue"    label="Usuarios"         value={profilesCount}       sub="Perfiles registrados" />
        <KpiCard icon={Clock}         color="emerald" label="Fichajes hoy"     value={fichajesHoy}         sub="Registros de jornada" />
        <KpiCard icon={Sparkles}      color="amber"   label="MRR Estimado"     value={fmt(mrr)}            sub={`${fmt(mrr * 12)} / año`} />
        <KpiCard icon={Wallet}        color="purple"  label="Saldo Wallets"    value={fmt(walletTotal)}    sub="Total todas las wallets" />
      </div>

      {/* ── Wallets sin fondos ── */}
      <div className="gc" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: alertasWallet.length > 0 ? '1px solid var(--border-color)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          {alertasWallet.length > 0
            ? <><AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Wallets sin fondos</p>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-darker)', marginLeft: 4 }}>saldo insuficiente para cubrir un mes de planes activos</span></>
            : <><div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                </div>
                <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)' }}>Todas las wallets con fondos suficientes</p></>
          }
        </div>
        {alertasWallet.length > 0 && <>
          {alertasWallet.map(({ owner, deps, depMrr }) => {
            const urgent    = (owner.wallet_balance ?? 0) < 0;
            const accent    = urgent ? '#ef4444' : '#f59e0b';
            const accentBg  = urgent ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)';
            const expanded  = expandedWallets.has(owner.id);
            const toggle    = () => setExpandedWallets(prev => {
              const next = new Set(prev);
              next.has(owner.id) ? next.delete(owner.id) : next.add(owner.id);
              return next;
            });
            return (
              <div key={owner.id} style={{ borderBottom: '1px solid var(--border-color)' }}>

                {/* ── Wallet destacada (clickable) ── */}
                <button onClick={toggle} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', gap: 16,
                  background: accentBg, borderLeft: `3px solid ${accent}`,
                  border: 'none', borderBottom: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: `${accent}1a`, border: `1px solid ${accent}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Wallet size={16} style={{ color: accent }} />
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, color: 'white', fontSize: '0.92rem', marginBottom: 2 }}>{owner.full_name || 'Sin nombre'}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>
                        {deps.length} {deps.length === 1 ? 'organización' : 'organizaciones'} · {fmt(depMrr)}/mes comprometidos
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 900, fontSize: '1.15rem', color: accent, lineHeight: 1 }}>{fmt(owner.wallet_balance ?? 0)}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-darker)', marginTop: 2 }}>saldo disponible</p>
                    </div>
                    <ChevronDown size={14} style={{ color: 'var(--text-darker)', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  </div>
                </button>

                {/* ── Empresas dependientes (colapsable) ── */}
                {expanded && deps.map((c, idx) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 20px', gap: 8,
                    background: 'rgba(0,0,0,0.1)',
                    borderTop: idx === 0 ? '1px solid var(--border-color)' : 'none',
                    borderBottom: idx < deps.length - 1 ? '1px solid rgba(255,255,255,0.025)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Building2 size={10} style={{ color: 'var(--text-darker)', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-darker)' }}>{c.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlanBadge plan={c.plan} />
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-darker)', minWidth: 48, textAlign: 'right' }}>{fmt(planPrice(c.plan))}/mes</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>}
      </div>

      {/* ── Transacciones (izq) + Planes & Organizaciones (der) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* Columna izquierda: Transacciones */}
        <div className="gc" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Últimas Transacciones</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>Movimientos recientes en wallets</p>
          </div>
          {transactions.length === 0
            ? <Empty text="Sin transacciones recientes" />
            : transactions.map(tx => {
              const isIncome = tx.type === 'deposit' || tx.type === 'refund';
              const amt = Math.abs(tx.amount_gross ?? tx.amount);
              return (
                <div key={tx.id} className="dtr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: isIncome ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isIncome ? <ArrowDownLeft size={12} style={{ color: 'var(--success-light)' }} /> : <ArrowUpRight size={12} style={{ color: 'var(--primary-light)' }} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'Movimiento'}</p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)' }}>{tx.companies?.name ?? '—'} · {fmtDate(tx.created_at)}</p>
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, color: isIncome ? 'var(--success-light)' : 'var(--primary-light)' }}>
                    {isIncome ? '+' : '−'}{fmt(amt)}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Columna derecha: Distribución de planes + Últimas organizaciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Distribución de planes */}
          <div className="gc" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Distribución de Planes</p>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>{companies.length} organizaciones</span>
            </div>

            <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', gap: 2, marginBottom: 20 }}>
              {planDistrib.map(p => {
                const pct = companies.length > 0 ? Math.round((p.count / companies.length) * 100) : 0;
                return (
                  <div key={p.plan} title={`${p.label}: ${p.count} organización${p.count !== 1 ? 'es' : ''} · ${pct}%`}
                    style={{ flex: p.count, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default', transition: 'flex 0.4s ease', minWidth: 0, overflow: 'hidden' }}>
                    {pct >= 12 && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(0,0,0,0.55)', whiteSpace: 'nowrap' }}>{pct}%</span>}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 20, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-darker)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Ingresos estimados por plan</p>
              {planDistrib.filter(p => planPrice(p.plan) > 0).map(p => (
                <div key={p.plan} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.label} × {p.count}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {fmt(planPrice(p.plan) * p.count)}<span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text-darker)' }}>/mes</span>
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total MRR</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--warning)' }}>
                  {fmt(mrr)}<span style={{ fontSize: '0.62rem', fontWeight: 400, color: 'var(--text-darker)' }}>/mes</span>
                </span>
              </div>
            </div>
          </div>

          {/* Últimas organizaciones */}
          <div className="gc" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>Últimas Organizaciones Registradas</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>Más recientes primero</p>
            </div>
            {recentCompanies.map(c => (
              <div key={c.id} className="dtr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-color)', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={12} style={{ color: 'var(--text-darker)' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)' }}>{fmtDate(c.created_at)}</p>
                  </div>
                </div>
                <PlanBadge plan={c.plan} />
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Sub-componentes ──────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  icon: React.ElementType; color: string; label: string; value: string | number; sub: string;
}> = ({ icon: Icon, color, label, value, sub }) => {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    purple: { bg: 'rgba(139,92,246,0.1)',  text: 'var(--primary-light)',   border: 'rgba(139,92,246,0.2)' },
    blue:   { bg: 'rgba(59,130,246,0.1)',  text: 'var(--secondary-light)', border: 'rgba(59,130,246,0.2)' },
    emerald:{ bg: 'rgba(16,185,129,0.1)',  text: 'var(--success-light)',   border: 'rgba(16,185,129,0.2)' },
    amber:  { bg: 'rgba(245,158,11,0.1)',  text: 'var(--warning)',         border: 'rgba(245,158,11,0.2)' },
    red:    { bg: 'rgba(239,68,68,0.1)',   text: 'var(--danger-light)',    border: 'rgba(239,68,68,0.2)'  },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="gc" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 110 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text }}>
        <Icon size={15} />
      </div>
      <div>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
        <p style={{ fontSize: '1.45rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-title)', lineHeight: 1, marginBottom: 3 }}>{value}</p>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-darker)' }}>{sub}</p>
      </div>
    </div>
  );
};

const PlanBadge: React.FC<{ plan: string }> = ({ plan }) => {
  const meta = PLAN_META[(plan || 'free').toLowerCase()] ?? { label: plan, color: '#6b7280' };
  return (
    <span style={{ fontSize: '0.68rem', padding: '2px 7px', borderRadius: 100, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}28`, fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>
      {meta.label}
    </span>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--text-darker)', fontSize: '0.82rem' }}>{text}</div>
);
