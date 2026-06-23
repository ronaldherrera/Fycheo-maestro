import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/utils';
import {
    Wallet, TrendingUp, TrendingDown, CircleDollarSign,
    RefreshCw, Sparkles, CalendarDays,
} from 'lucide-react';
import {
    ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WalletActiva {
    id: string;
    accountId: string; // profile ID del dueño de cuenta (para navegar a Soporte)
    nombre: string;
    balance: number;
    plan?: string; // solo empresas
}

interface Transaction {
    id: string;
    amount: number;
    amount_gross?: number;
    type: string;
    description: string;
    created_at: string;
    company_id: string | null;
    companies?: { name: string } | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PLAN_PRICES: Record<string, number> = {
    gratis: 0, basico: 15, estandar: 29, avanzado: 59, expansion: 99, elite: 149, enterprise: 0,
    // Legacy (por si existen registros anteriores a la migración)
    free: 0, basic: 15, pro: 29, business: 59, ultimate: 99, premium: 149,
};

const PLAN_META: Record<string, { label: string; color: string }> = {
    gratis:     { label: 'Gratis',    color: '#6b7280' },
    basico:     { label: 'Básico',    color: '#60a5fa' },
    estandar:   { label: 'Estándar',  color: '#818cf8' },
    avanzado:   { label: 'Avanzado',  color: '#a78bfa' },
    expansion:  { label: 'Expansión', color: '#f59e0b' },
    elite:      { label: 'Élite',     color: '#f97316' },
    enterprise: { label: 'Enterprise',color: '#34d399' },
    // Legacy
    free:       { label: 'Free',      color: '#6b7280' },
    basic:      { label: 'Básico',    color: '#60a5fa' },
    pro:        { label: 'Estándar',  color: '#818cf8' },
    business:   { label: 'Avanzado',  color: '#a78bfa' },
    premium:    { label: 'Élite',     color: '#f97316' },
};

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
            <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{label}</p>
            {payload.map((p: any) => (
                <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span style={{ color: 'white', fontWeight: 700 }}>{fmt(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const Finanzas: React.FC<{ onGoToSupport: (accountId: string) => void }> = ({ onGoToSupport }) => {
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [wallets, setWallets]           = useState<WalletActiva[]>([]);
    const [companies, setCompanies]       = useState<{ id: string; plan: string }[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const [{ data: companiesData }, { data: profilesData }, { data: txData }] = await Promise.all([
                supabase.from('companies').select('id, name, plan, wallet_balance').order('wallet_balance', { ascending: false }),
                supabase.from('profiles').select('id, full_name, email, wallet_balance').gt('wallet_balance', 0).order('wallet_balance', { ascending: false }),
                supabase.from('transactions')
                    .select('id, amount, amount_gross, type, description, created_at, company_id, companies(name)')
                    .order('created_at', { ascending: false })
                    .limit(500),
            ]);

            const orgs: WalletActiva[] = (companiesData ?? []).map((c: any) => ({
                id: c.id, accountId: c.owner_id, nombre: c.name, balance: c.wallet_balance ?? 0, plan: c.plan,
            }));
            const personales: WalletActiva[] = (profilesData ?? []).map((p: any) => ({
                id: p.id, accountId: p.id, nombre: p.full_name || p.email || 'Cuenta', balance: p.wallet_balance ?? 0,
            }));

            // Unificadas y ordenadas por saldo
            const unified = [...orgs, ...personales].sort((a, b) => b.balance - a.balance);
            setWallets(unified);
            setCompanies((companiesData ?? []).map((c: any) => ({ id: c.id, plan: c.plan })));
            setTransactions((txData ?? []) as unknown as Transaction[]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // ── Métricas ──────────────────────────────────────────────────────────────
    const metrics = useMemo(() => {
        const saldoTotal = wallets.reduce((s, w) => s + w.balance, 0);
        let totalRecargado = 0, totalCobrado = 0;
        for (const tx of transactions) {
            const amt = Math.abs(tx.amount_gross ?? tx.amount);
            if (tx.type === 'deposit' || tx.type === 'refund')           totalRecargado += amt;
            else if (tx.type === 'purchase' || tx.type === 'withdrawal') totalCobrado   += amt;
        }
        return { saldoTotal, totalRecargado, totalCobrado };
    }, [wallets, transactions]);

    // ── Gráfica últimos 12 meses ───────────────────────────────────────────────
    const chartData = useMemo(() => {
        const now = new Date();
        return Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const [y, m] = [d.getFullYear(), d.getMonth()];
            let recargado = 0, cobrado = 0;
            for (const tx of transactions) {
                const td = new Date(tx.created_at);
                if (td.getFullYear() !== y || td.getMonth() !== m) continue;
                const amt = Math.abs(tx.amount_gross ?? tx.amount);
                if (tx.type === 'deposit' || tx.type === 'refund')           recargado += amt;
                else if (tx.type === 'purchase' || tx.type === 'withdrawal') cobrado   += amt;
            }
            return { mes: MONTHS_ES[m], Recargado: recargado, Cobrado: cobrado };
        });
    }, [transactions]);

    // ── MRR por plan (solo empresas tienen plan) ───────────────────────────────
    const mrrData = useMemo(() => {
        const byPlan: Record<string, number> = {};
        for (const c of companies) {
            const p = (c.plan || 'free').toLowerCase();
            byPlan[p] = (byPlan[p] ?? 0) + 1;
        }
        const rows = Object.entries(byPlan).map(([plan, count]) => ({
            plan,
            ...PLAN_META[plan] ?? { label: plan, color: '#6b7280' },
            count,
            price: PLAN_PRICES[plan] ?? 0,
            mrr: count * (PLAN_PRICES[plan] ?? 0),
        })).sort((a, b) => b.mrr - a.mrr);
        const totalMrr = rows.reduce((s, r) => s + r.mrr, 0);
        return { rows, totalMrr };
    }, [companies]);

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(139,92,246,0.15)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
    );

    return (
        <div style={{ padding: '0 0 56px 0' }}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } .gc { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; } .ftr:hover { background: rgba(255,255,255,0.015); }`}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <nav style={{ fontSize: '0.78rem', color: 'var(--text-darker)', marginBottom: 6 }}>Finanzas</nav>
                    <h1 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-title)', lineHeight: 1.1 }}>Seguimiento Financiero</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 5 }}>Saldos, ingresos y MRR estimado de todas las wallets activas.</p>
                </div>
                <button onClick={() => loadData(true)} disabled={refreshing}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem', opacity: refreshing ? 0.5 : 1 }}>
                    <RefreshCw size={13} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
                    Actualizar
                </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                <KpiCard icon={Wallet}          color="purple"  label="Saldo Total en Wallets"   value={fmt(metrics.saldoTotal)}      sub={`${wallets.filter(w => w.balance > 0).length} wallets activas`} />
                <KpiCard icon={TrendingUp}      color="emerald" label="Total Recargado"           value={fmt(metrics.totalRecargado)}  sub="Suma histórica de recargas" />
                <KpiCard icon={CircleDollarSign} color="blue"   label="Total Cobrado"             value={fmt(metrics.totalCobrado)}    sub="Descontado de wallets — ingreso nuestro" />
                <KpiCard icon={Sparkles}        color="amber"   label="MRR Estimado"              value={fmt(mrrData.totalMrr)}        sub={`${fmt(mrrData.totalMrr * 12)} / año`} />
            </div>

            {/* Gráfica + Ratio */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 24 }}>
                <div className="gc" style={{ padding: 24 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 2 }}>Actividad Mensual</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)', marginBottom: 18 }}>Últimos 12 meses</p>
                    <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={chartData.map(d => ({ ...d, MRR: mrrData.totalMrr }))} barCategoryGap="25%">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} width={44} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 10 }} iconType="circle" iconSize={7} />
                            <Bar dataKey="Recargado" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Cobrado"   fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            <Line dataKey="MRR" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" dot={false} name="MRR estimado" />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>

                <div className="gc" style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
                    <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Ratio de consumo</p>
                        {metrics.totalRecargado > 0 ? (
                            <>
                                <p style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--primary-light)', lineHeight: 1 }}>
                                    {((metrics.totalCobrado / metrics.totalRecargado) * 100).toFixed(1)}%
                                </p>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)', marginTop: 3, marginBottom: 14 }}>del total recargado ya cobrado</p>
                                <div style={{ height: 6, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 6 }}>
                                    <div style={{ height: '100%', width: `${Math.min((metrics.totalCobrado / metrics.totalRecargado) * 100, 100)}%`, background: 'linear-gradient(90deg,#8b5cf6,#a78bfa)', borderRadius: 100 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-darker)' }}>
                                    <span>0€</span><span>{fmt(metrics.totalRecargado)}</span>
                                </div>
                            </>
                        ) : <p style={{ color: 'var(--text-darker)', fontSize: '0.8rem' }}>Sin datos</p>}
                    </div>
                    <div style={{ height: 1, background: 'var(--border-color)' }} />
                    <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pendiente por consumir</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>{fmt(metrics.saldoTotal)}</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)', marginTop: 3 }}>saldo aún en wallets</p>
                    </div>
                </div>
            </div>

            {/* Tabla wallets activas */}
            <div className="gc" style={{ overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Wallet size={15} style={{ color: 'var(--text-muted)' }} />
                    <div>
                        <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Wallets Activas</p>
                        <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>{wallets.filter(w => w.balance > 0).length} wallets con saldo — ordenadas de mayor a menor</p>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {['Nombre', 'Plan', 'Saldo', 'Total recargado', 'Total cobrado'].map((h, i) => (
                                    <th key={h} style={{ padding: '9px 20px', textAlign: i < 2 ? 'left' : 'right', color: 'var(--text-darker)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {wallets.filter(w => w.balance > 0).map(w => {
                                const companyTx = transactions.filter(tx => tx.company_id === w.id);
                                let recargado = 0, cobrado = 0;
                                for (const tx of companyTx) {
                                    const amt = Math.abs(tx.amount_gross ?? tx.amount);
                                    if (tx.type === 'deposit' || tx.type === 'refund')           recargado += amt;
                                    else if (tx.type === 'purchase' || tx.type === 'withdrawal') cobrado   += amt;
                                }
                                const meta = w.plan ? (PLAN_META[(w.plan).toLowerCase()] ?? { label: w.plan, color: '#6b7280' }) : null;
                                return (
                                    <tr key={w.id} className="ftr" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '11px 20px' }}>
                                            <button onClick={() => onGoToSupport(w.accountId)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textAlign: 'left', transition: 'color 0.15s' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary-light)')}
                                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-main)')}>
                                                {w.nombre}
                                            </button>
                                        </td>
                                        <td style={{ padding: '11px 20px' }}>
                                            {meta ? (
                                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 100, background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}28`, fontWeight: 700 }}>
                                                    {meta.label}
                                                </span>
                                            ) : <span style={{ color: 'var(--text-darker)', fontSize: '0.78rem' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, color: w.balance > 0 ? 'var(--success-light)' : 'var(--text-darker)' }}>
                                            {fmt(w.balance)}
                                        </td>
                                        <td style={{ padding: '11px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(recargado)}</td>
                                        <td style={{ padding: '11px 20px', textAlign: 'right', color: 'var(--primary-light)', fontWeight: 600 }}>{fmt(cobrado)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                                <td colSpan={2} style={{ padding: '10px 20px', fontSize: '0.7rem', color: 'var(--text-darker)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total — {wallets.filter(w => w.balance > 0).length} wallet{wallets.filter(w => w.balance > 0).length !== 1 ? 's' : ''} activa{wallets.filter(w => w.balance > 0).length !== 1 ? 's' : ''}
                                </td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 800, color: 'white' }}>{fmt(metrics.saldoTotal)}</td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600 }}>{fmt(metrics.totalRecargado)}</td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', color: 'var(--primary-light)', fontWeight: 800 }}>{fmt(metrics.totalCobrado)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* MRR por plan */}
            <div className="gc" style={{ overflow: 'hidden', marginBottom: 24 }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Sparkles size={15} style={{ color: 'var(--primary-light)' }} />
                        <div>
                            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Estimación por Planes Contratados</p>
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>MRR y ARR estimados según los planes activos</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 20 }}>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.67rem', color: 'var(--text-darker)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>MRR</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary-light)', lineHeight: 1.1 }}>{fmt(mrrData.totalMrr)}<span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>/mes</span></p>
                        </div>
                        <div style={{ width: 1, background: 'var(--border-color)' }} />
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.67rem', color: 'var(--text-darker)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ARR</p>
                            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success-light)', lineHeight: 1.1 }}>{fmt(mrrData.totalMrr * 12)}<span style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-muted)' }}>/año</span></p>
                        </div>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                {['Plan', 'Precio/mes', 'Wallets', 'MRR', 'ARR', 'Peso'].map((h, i) => (
                                    <th key={h} style={{ padding: '9px 20px', textAlign: i === 0 ? 'left' : 'right', color: 'var(--text-darker)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {mrrData.rows.map(row => {
                                const pct = mrrData.totalMrr > 0 ? (row.mrr / mrrData.totalMrr) * 100 : 0;
                                return (
                                    <tr key={row.plan} className="ftr" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '12px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                                                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{row.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right', color: row.price > 0 ? 'var(--text-muted)' : 'var(--text-darker)' }}>
                                            {row.price > 0 ? fmt(row.price) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--text-main)' }}>{row.count}</td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, color: row.mrr > 0 ? row.color : 'var(--text-darker)' }}>
                                            {row.mrr > 0 ? fmt(row.mrr) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                            {row.mrr > 0 ? fmt(row.mrr * 12) : '—'}
                                        </td>
                                        <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                            {row.mrr > 0 && mrrData.totalMrr > 0 ? (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                                                    <div style={{ width: 60, height: 3, borderRadius: 100, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 100 }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', minWidth: 38, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                                                </div>
                                            ) : <span style={{ color: 'var(--text-darker)', fontSize: '0.75rem' }}>—</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                                <td colSpan={2} style={{ padding: '10px 20px', fontSize: '0.7rem', color: 'var(--text-darker)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total — {companies.length} wallets con plan
                                </td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>{companies.length}</td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 800, color: 'var(--primary-light)', fontSize: '0.9rem' }}>
                                    {fmt(mrrData.totalMrr)}<span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>/mes</span>
                                </td>
                                <td style={{ padding: '10px 20px', textAlign: 'right', fontWeight: 800, color: 'var(--success-light)', fontSize: '0.9rem' }}>
                                    {fmt(mrrData.totalMrr * 12)}<span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>/año</span>
                                </td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <CalendarDays size={12} style={{ color: 'var(--text-darker)', flexShrink: 0 }} />
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>Estimación basada en los planes actualmente asignados. No incluye descuentos ni periodos de gracia.</p>
                </div>
            </div>

            {/* Últimos movimientos */}
            <RecentTransactions transactions={transactions} />
        </div>
    );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
    icon: React.ElementType; color: 'purple' | 'blue' | 'emerald' | 'amber';
    label: string; value: string; sub: string;
}> = ({ icon: Icon, color, label, value, sub }) => {
    const c = {
        purple:  { bg: 'rgba(139,92,246,0.1)',  text: 'var(--primary-light)',   border: 'rgba(139,92,246,0.2)' },
        blue:    { bg: 'rgba(59,130,246,0.1)',   text: 'var(--secondary-light)', border: 'rgba(59,130,246,0.2)' },
        emerald: { bg: 'rgba(16,185,129,0.1)',   text: 'var(--success-light)',   border: 'rgba(16,185,129,0.2)' },
        amber:   { bg: 'rgba(245,158,11,0.1)',   text: 'var(--warning)',         border: 'rgba(245,158,11,0.2)' },
    }[color];
    return (
        <div className="gc" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 118 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: c.bg, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.text }}>
                <Icon size={16} />
            </div>
            <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', fontFamily: 'var(--font-title)', lineHeight: 1, marginBottom: 3 }}>{value}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>{sub}</p>
            </div>
        </div>
    );
};

// ─── Últimos movimientos ───────────────────────────────────────────────────────

const RecentTransactions: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const recent = transactions
        .filter(tx => tx.type === 'purchase' || tx.type === 'withdrawal' || tx.type === 'deposit')
        .slice(0, 10);
    if (!recent.length) return null;
    return (
        <div className="gc" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingDown size={15} style={{ color: 'var(--text-muted)' }} />
                <div>
                    <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>Últimos Movimientos</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>Recargas y cobros recientes de todas las wallets</p>
                </div>
            </div>
            {recent.map(tx => {
                const isIncome = tx.type === 'deposit' || tx.type === 'refund';
                const amt = Math.abs(tx.amount_gross ?? tx.amount);
                return (
                    <div key={tx.id} className="ftr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 24px', borderBottom: '1px solid var(--border-color)', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 7, background: isIncome ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {isIncome ? <TrendingUp size={13} style={{ color: 'var(--success-light)' }} /> : <TrendingDown size={13} style={{ color: 'var(--primary-light)' }} />}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <p style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || 'Movimiento'}</p>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>
                                    {(tx as any).companies?.name ?? '—'} · {formatDate(tx.created_at)}
                                </p>
                            </div>
                        </div>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', flexShrink: 0, color: isIncome ? 'var(--success-light)' : 'var(--primary-light)' }}>
                            {isIncome ? '+' : '−'}{fmt(amt)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
