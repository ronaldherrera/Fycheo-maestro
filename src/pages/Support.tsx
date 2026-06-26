import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateTime } from '../lib/utils';
import { PLAN_META, PLAN_PRICES, PLAN_LIMITS, PLAN_EXTRA_PRICES } from '../utils/planConfig';
import {
  Search, RefreshCw, Building2, Users, Smartphone,
  ChevronRight, ArrowLeft, CreditCard,
  Clock, UserCheck, Coins, Mail,
  Shield, Pencil, Send, Euro, X,
  Plus, Trash2, History
} from 'lucide-react';

/* ── TIPOS ── */
interface Company {
  id: string;
  name: string;
  plan: string;
  balance?: number;
  wallet_balance?: number;
  kiosk_limit: number;
  created_at: string;
  fiscal_name?: string;
  cif?: string;
  owner_id?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email?: string;
  dni_nie?: string;
  ss_number?: string;
  role?: string;
  company_id?: string;
  created_at: string;
  wallet_balance?: number;
  phone?: string;
}

interface TimeEntry {
  id: string;
  profile_id?: string;
  user_id?: string;
  check_in?: string;
  check_out?: string | null;
  entry_type?: string;
  occurred_at?: string;
  description?: string;
  date?: string;
  entry_time?: string;
  is_manual?: boolean;
  status?: string;
}

interface Transaction {
  id: string;
  amount_gross: number;
  amount_net: number;
  type: string;
  description: string;
  payment_method_details?: string;
  invoice_status?: string; // paid | pending | cancelled | refunded
  invoice_number?: string;
  created_at: string;
}

interface CompanyMember {
  company_id: string;
  user_id: string;
  role: string;
}

type SupportView =
  | { level: 'accounts' }
  | { level: 'account-detail'; account: Profile }
  | { level: 'company-detail'; company: Company; owner: Profile };

interface SupportProps {
  setIsComposeOpen?: (open: boolean) => void;
  setComposePreset?: (preset: any) => void;
  preselectedAccountId?: string | null;
}

/* ── HELPERS DE FORMATO ── */

function planMeta(plan: string) {
  return PLAN_META[plan?.toLowerCase()] ?? { label: plan?.toUpperCase() || 'Sin plan', color: '#9ca3af', bg: 'rgba(156,163,175,0.1)' };
}


function fmtBalance(n: number) {
  return `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(2)} €`;
}

/* ═══════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ═══════════════════════════════════════════ */
export const Support: React.FC<SupportProps> = ({
  setIsComposeOpen,
  setComposePreset,
  preselectedAccountId,
}) => {
  const [view, setView] = useState<SupportView>({ level: 'accounts' });
  const [accounts, setAccounts] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyMembers, setCompanyMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Carga inicial: Cuentas (owners), empresas y sus miembros
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar todas las empresas primero para asociar en memoria y extraer propietarios
      const { data: companiesData } = await supabase
        .from('companies')
        .select('*');

      const comps = companiesData || [];
      setCompanies(comps);

      // 2. Cargar todos los miembros de empresas para realizar cruce relacional (asociación de gestores a múltiples empresas)
      const { data: membersData } = await supabase
        .from('company_members')
        .select('*');

      const compMbrs = (membersData || []) as CompanyMember[];
      setCompanyMembers(compMbrs);

      // 3. Obtener IDs únicos de propietarios de empresas
      const ownerIdsFromCompanies = comps.map(c => c.owner_id).filter(Boolean) as string[];
      // Obtener IDs de usuarios administradores/gestores desde company_members
      const adminRoles = ['admin', 'hr', 'manager', 'owner'];
      const ownerIdsFromMembers = compMbrs
        .filter(m => adminRoles.includes(m.role?.toLowerCase()))
        .map(m => m.user_id)
        .filter(Boolean);

      const ownerIds = Array.from(new Set([...ownerIdsFromCompanies, ...ownerIdsFromMembers]));

      // 4. Cargar perfiles que sean dueños de estas empresas, miembros gestores o tengan el rol 'owner'
      let query = supabase.from('profiles').select('*');
      
      if (ownerIds.length > 0) {
        query = query.or(`id.in.(${ownerIds.join(',')}),role.eq.owner,role.eq.admin`);
      } else {
        query = query.or('role.eq.owner,role.eq.admin');
      }

      const { data: profilesData } = await query.order('created_at', { ascending: false });
      if (profilesData) setAccounts(profilesData);
    } catch (err) {
      console.error('Error al cargar datos en Soporte:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navegar automáticamente al detalle de cuenta cuando viene preseleccionada
  useEffect(() => {
    if (!preselectedAccountId || loading || accounts.length === 0) return;
    const account = accounts.find(a => a.id === preselectedAccountId);
    if (account) setView({ level: 'account-detail', account });
  }, [preselectedAccountId, accounts, loading]);

  // Contar empresas y balance total por cada dueño (incluye empresas de las que es miembro administrador)
  const getAccountStats = (ownerId: string) => {
    const ownerCompanies = companies.filter(c => {
      const isOwner = c.owner_id === ownerId;
      const isMember = companyMembers.some(m => m.company_id === c.id && m.user_id === ownerId);
      return isOwner || isMember;
    });

    const companiesBalance = ownerCompanies.reduce((acc, c) => {
      const bal = c.wallet_balance !== undefined ? c.wallet_balance : (c.balance ?? 0);
      return acc + bal;
    }, 0);

    const personalBalance = accounts.find(a => a.id === ownerId)?.wallet_balance ?? 0;
    const totalBalance = personalBalance + companiesBalance;

    const totalEmployees = ownerCompanies.reduce((acc, c) => {
      const count = companyMembers.filter(m => m.company_id === c.id && m.role?.toLowerCase() === 'employee').length;
      return acc + count;
    }, 0);

    return {
      companiesCount: ownerCompanies.length,
      totalBalance,
      companiesList: ownerCompanies,
      totalEmployees
    };
  };

  const filteredAccounts = accounts.filter(acc => {
    const q = searchQuery.toLowerCase();
    return (
      acc.full_name?.toLowerCase().includes(q) ||
      acc.email?.toLowerCase().includes(q) ||
      acc.dni_nie?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }} className="animate-fade-in">
      {/* Cabecera / Breadcrumbs */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={breadcrumbsStyle}>
          <span
            onClick={() => setView({ level: 'accounts' })}
            style={{ ...breadcrumbItemStyle, cursor: view.level !== 'accounts' ? 'pointer' : 'default' }}
          >
            Soporte
          </span>

          {view.level !== 'accounts' && (
            <>
              <ChevronRight size={14} style={{ color: 'var(--text-darker)' }} />
              <span
                onClick={() => setView({ level: 'account-detail', account: (view as any).account || (view as any).owner })}
                style={{
                  ...breadcrumbItemStyle,
                  cursor: view.level !== 'account-detail' ? 'pointer' : 'default',
                  fontWeight: view.level === 'account-detail' ? 600 : 400,
                  color: view.level === 'account-detail' ? 'var(--text-main)' : 'var(--text-muted)'
                }}
              >
                {((view as any).account || (view as any).owner).full_name}
              </span>
            </>
          )}

          {view.level === 'company-detail' && (
            <>
              <ChevronRight size={14} style={{ color: 'var(--text-darker)' }} />
              <span
                style={{
                  ...breadcrumbItemStyle,
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'default'
                }}
              >
                {view.company.name}
              </span>
            </>
          )}
        </div>

        {/* Info general o botón de regreso rápido */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
          {view.level !== 'accounts' && (
            <button
              onClick={() => {
                if (view.level === 'company-detail') {
                  setView({ level: 'account-detail', account: view.owner });
                } else {
                  setView({ level: 'accounts' });
                }
              }}
              style={backBtnStyle}
            >
              <ArrowLeft size={16} /> Volver
            </button>
          )}
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {view.level === 'accounts' && 'Soporte a Clientes'}
              {view.level === 'account-detail' && `Cuenta: ${view.account.full_name}`}
              {view.level === 'company-detail' && `Organización: ${view.company.name}`}
            </h1>
          </div>
        </div>
      </div>

      {/* RENDERIZADO DE VISTAS */}
      {loading ? (
        <Spinner />
      ) : (
        <>
          {view.level === 'accounts' && (
            <ViewAccounts
              accounts={filteredAccounts}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectAccount={(account) => setView({ level: 'account-detail', account })}
              getAccountStats={getAccountStats}
              onReload={loadData}
            />
          )}

          {view.level === 'account-detail' && (
            <ViewAccountDetail
              account={view.account}
              companies={getAccountStats(view.account.id).companiesList}
              companyMembers={companyMembers}
              onSelectCompany={(company) => setView({ level: 'company-detail', company, owner: view.account })}
              setIsComposeOpen={setIsComposeOpen}
              setComposePreset={setComposePreset}
              onUpdateAccount={(updatedAccount) => {
                // Actualizar en la lista local de cuentas
                setAccounts(prev => prev.map(a => a.id === updatedAccount.id ? updatedAccount : a));
                // Actualizar en la vista actual
                setView({ level: 'account-detail', account: updatedAccount });
              }}
            />
          )}

          {view.level === 'company-detail' && (
            <ViewCompanyDetail
              company={view.company}
              owner={view.owner}
              onUpdateCompany={(updatedCompany) => {
                // Actualizar en la lista local de empresas
                setCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
                // Actualizar en la vista actual
                setView({ level: 'company-detail', company: updatedCompany, owner: view.owner });
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════
   VISTA: LISTA DE CUENTAS (CLIENTES)
   ═══════════════════════════════════════════ */
interface ViewAccountsProps {
  accounts: Profile[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectAccount: (acc: Profile) => void;
  getAccountStats: (ownerId: string) => { companiesCount: number; totalBalance: number; totalEmployees: number };
  onReload: () => void;
}

const ViewAccounts: React.FC<ViewAccountsProps> = ({
  accounts,
  searchQuery,
  setSearchQuery,
  onSelectAccount,
  getAccountStats,
  onReload
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filtros */}
      <div style={filterBarStyle}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-darker)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, email o DNI/NIE..."
            style={{ ...inputSt, paddingLeft: 36 }}
          />
        </div>
        <button onClick={onReload} style={iconBtnSt} title="Recargar clientes"><RefreshCw size={15} /></button>
      </div>

      {/* Listado de Cuentas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {accounts.length === 0 ? (
          <Empty text="No se encontraron clientes registrados con rol Owner o como propietarios de organizaciones" />
        ) : (
          accounts.map(acc => {
            const stats = getAccountStats(acc.id);
            const isNeg = stats.totalBalance < 0;
            return (
              <div key={acc.id} style={rowStyle} className="hover-card">
                {/* Avatar */}
                <div style={avatarCircleStyle}>
                  <Users size={18} color="var(--primary-light, #c4b5fd)" />
                </div>

                {/* Datos del Cliente */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem', marginBottom: 2 }}>{acc.full_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} /> {acc.email || 'Sin email'}</span>
                    {acc.dni_nie && <span>• DNI: {acc.dni_nie}</span>}
                  </div>
                </div>

                {/* Estadísticas de Empresas del Cliente */}
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginRight: '1rem' }}>
                  {/* Organizaciones */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {stats.companiesCount} org · {stats.totalEmployees} trab.
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>Empresas y plantilla</div>
                  </div>

                  {/* Wallet Consolidado */}
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: isNeg ? '#f87171' : '#34d399' }}>
                      {fmtBalance(stats.totalBalance)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-darker)' }}>Saldo total</div>
                  </div>
                </div>

                {/* Botón Acción */}
                <button onClick={() => onSelectAccount(acc)} style={actionBtnSt}>
                  Administrar <ChevronRight size={14} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   VISTA: DETALLE DE CUENTA
   ═══════════════════════════════════════════ */
interface ViewAccountDetailProps {
  account: Profile;
  companies: Company[];
  companyMembers: CompanyMember[];
  onSelectCompany: (company: Company) => void;
  setIsComposeOpen?: (open: boolean) => void;
  setComposePreset?: (preset: any) => void;
  onUpdateAccount: (updatedAccount: Profile) => void;
}

const ViewAccountDetail: React.FC<ViewAccountDetailProps> = ({
  account,
  companies,
  companyMembers,
  onSelectCompany,
  setIsComposeOpen,
  setComposePreset,
  onUpdateAccount
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Estados para Modales de Soporte
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAdjustBalance, setShowAdjustBalance] = useState(false);
  
  // Datos del formulario de edición de perfil
  const [profileForm, setProfileForm] = useState({
    full_name: account.full_name || '',
    dni_nie: account.dni_nie || '',
    phone: account.phone || '',
    ss_number: account.ss_number || ''
  });

  // Datos del formulario de operación de saldo (Añadir / Cobrar)
  const [walletAmount, setWalletAmount] = useState<string>('');
  const [walletConcept, setWalletConcept] = useState<string>('');
  const [walletAction, setWalletAction] = useState<'add' | 'charge'>('add');
  const [saving, setSaving] = useState(false);

  const fetchTxs = useCallback(async () => {
    setLoadingTx(true);
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', account.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (data) setTransactions(data);
    } catch (err) {
      console.error('Error al cargar transacciones del cliente:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [account.id]);

  useEffect(() => {
    fetchTxs();
  }, [fetchTxs]);

  const cancelTransaction = async (txId: string) => {
    if (!confirm('¿Marcar esta transferencia como cancelada? No se modificará el saldo automáticamente.')) return;
    const { error } = await supabase.from('transactions').update({ invoice_status: 'cancelled' }).eq('id', txId);
    if (!error) setTransactions(prev => prev.map(tx => tx.id === txId ? { ...tx, invoice_status: 'cancelled' } : tx));
  };

  const txStatusBadge = (status?: string) => {
    if (!status || status === 'paid') return null;
    const map: Record<string, { label: string; color: string; bg: string }> = {
      pending:   { label: 'Pendiente',   color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
      cancelled: { label: 'Cancelado',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
      refunded:  { label: 'Reembolsado', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
    };
    const s = map[status] ?? { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
    return (
      <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {s.label}
      </span>
    );
  };

  // Inicializar formularios
  const handleOpenEditProfile = () => {
    setProfileForm({
      full_name: account.full_name || '',
      dni_nie: account.dni_nie || '',
      phone: account.phone || '',
      ss_number: account.ss_number || ''
    });
    setShowEditProfile(true);
  };

  const handleOpenAdjustBalance = () => {
    setWalletAmount('');
    setWalletConcept('');
    setWalletAction('add');
    setShowAdjustBalance(true);
  };

  // Guardar datos del perfil
  const handleSaveProfile = async () => {
    if (!profileForm.full_name.trim()) {
      alert('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          dni_nie: profileForm.dni_nie || null,
          phone: profileForm.phone || null,
          ss_number: profileForm.ss_number || null
        })
        .eq('id', account.id)
        .select()
        .single();

      if (!error && data) {
        onUpdateAccount(data);
        setShowEditProfile(false);
      } else {
        console.error('Error en Supabase RLS/Update:', error);
        alert(`Error al guardar perfil: ${error?.message || 'Permisos insuficientes'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error al realizar el guardado.');
    } finally {
      setSaving(false);
    }
  };

  // Guardar operación de saldo (Añadir / Cobrar)
  const handleSaveBalance = async () => {
    const amountVal = parseFloat(walletAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert('Introduce un importe válido mayor que cero.');
      return;
    }
    if (!walletConcept.trim()) {
      alert('El concepto de la operación es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const currentBal = account.wallet_balance || 0;
      const diff = walletAction === 'add' ? amountVal : -amountVal;
      const val = currentBal + diff;

      // 1. Insertar transacción de control documentando el motivo exacto
      await supabase.from('transactions').insert({
        user_id: account.id,
        amount: diff,
        amount_net: diff,
        amount_gross: diff,
        amount_vat: 0,
        type: walletAction === 'add' ? 'deposit' : 'withdrawal',
        description: walletConcept.trim(),
        invoice_status: 'paid',
        payment_method: 'other',
        payment_method_details: 'Operación manual de soporte',
        created_at: new Date().toISOString()
      });

      // 2. Actualizar balance de la cuenta
      const { data, error } = await supabase
        .from('profiles')
        .update({ wallet_balance: val })
        .eq('id', account.id)
        .select()
        .single();

      if (!error && data) {
        onUpdateAccount(data);
        setShowAdjustBalance(false);
        setWalletAmount('');
        setWalletConcept('');
        fetchTxs(); // Recargar historial de transacciones en caliente
      } else {
        console.error('Error en Supabase Balance Update:', error);
        alert(`Error al realizar la operación: ${error?.message || 'Permisos insuficientes'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error al realizar la operación en el wallet');
    } finally {
      setSaving(false);
    }
  };

  // Enviar correo mediante el Composer Global
  const handleSendEmail = () => {
    if (setIsComposeOpen && setComposePreset) {
      setComposePreset({
        to: account.email || '',
        subject: 'Soporte Técnico — Fycheo',
        body: `Hola ${account.full_name},\n\nNos ponemos en contacto desde el soporte de Fycheo para...\n\nUn saludo,\nEquipo de Fycheo`
      });
      setIsComposeOpen(true);
    } else {
      alert('El servicio de correo no está disponible en este momento.');
    }
  };

  // Suma de saldo total de la cuenta
  const personalWallet = account.wallet_balance || 0;
  const companiesWalletTotal = companies.reduce((a, c) => a + (c.wallet_balance !== undefined ? c.wallet_balance : (c.balance ?? 0)), 0);
  const totalConsolidated = personalWallet + companiesWalletTotal;

  // Previsión de gastos del próximo mes (renovaciones)
  const nextMonthForecast = companies.reduce((acc, c) => {
    if ((c as any).individual_billing) return acc;
    const planKey = c.plan?.toLowerCase() || 'basico';
    const price = PLAN_PRICES[planKey] ?? 0;
    return acc + price;
  }, 0);
  const isCovered = personalWallet >= nextMonthForecast;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Columna Izquierda: Información y Organizaciones */}
      <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
        
        {/* Ficha Cliente */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
            <h2 style={{ ...sectionTitleStyle, border: 'none', margin: 0, padding: 0 }}>
              <Shield size={16} color="var(--primary-light)" /> Información de la Cuenta
            </h2>
            
            {/* Opciones de soporte y gestión de perfil */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleSendEmail} style={actionBtnSmStyle} title="Enviar Correo Corporativo">
                <Send size={12} /> Correo
              </button>
              <button onClick={handleOpenEditProfile} style={actionBtnSmStyle} title="Editar Datos del Cliente">
                <Pencil size={12} /> Editar
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
            <DetailItem label="Nombre Completo" value={account.full_name} />
            <DetailItem label="Correo Electrónico" value={account.email || '—'} />
            <DetailItem label="DNI / NIE" value={account.dni_nie || '—'} />
            <DetailItem label="Teléfono de Contacto" value={account.phone || '—'} />
            <DetailItem label="Número de Seguridad Social" value={account.ss_number || '—'} />
            <DetailItem label="Fecha de Registro" value={formatDateTime(account.created_at)} />
          </div>
        </div>

        {/* Organizaciones / Empresas del Cliente */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            <Building2 size={16} color="var(--primary-light)" /> Organizaciones Habilitadas ({companies.length})
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Listado de empresas creadas por este cliente o donde es miembro administrativo. Pulsa en una de ellas para gestionar sus empleados, managers y terminales.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {companies.length === 0 ? (
              <Empty text="Este cliente no tiene organizaciones creadas ni asociadas." />
            ) : (
              companies.map(c => {
                const pm = planMeta(c.plan);
                const cBalance = c.wallet_balance !== undefined ? c.wallet_balance : (c.balance ?? 0);
                const empCount = companyMembers.filter(m => m.company_id === c.id && m.role?.toLowerCase() === 'employee').length;
                
                // Calcular cuota y fecha de próxima renovación
                const planPrice = PLAN_PRICES[c.plan?.toLowerCase() || 'basico'] ?? 0;
                const nextPaymentDate = (() => {
                  if (!c.created_at) return '—';
                  const created = new Date(c.created_at);
                  const now = new Date();
                  let nextDate = new Date(now.getFullYear(), now.getMonth(), created.getDate());
                  if (nextDate < now) {
                    nextDate.setMonth(nextDate.getMonth() + 1);
                  }
                  return nextDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                })();

                return (
                  <div key={c.id} style={innerRowStyle} className="hover-card">
                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.625rem' }}>
                      
                      {/* LÍNEA SUPERIOR: Info Empresa + Botón de Acceso */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem' }}>
                        {/* Info de la Empresa */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 auto' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: pm.bg, border: `1px solid ${pm.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Building2 size={16} color={pm.color} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.name}>
                              {c.name}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-darker)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.fiscal_name || 'Sin razón social'} {c.cif ? `· ${c.cif}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Botón Acceder */}
                        <button onClick={() => onSelectCompany(c)} style={actionBtnSmStyle}>
                          Acceder <ChevronRight size={12} />
                        </button>
                      </div>

                      {/* LÍNEA INFERIOR: Listado de Badges alineados */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem', paddingLeft: '44px' }}>
                        {/* Plan (Con Tooltip de Cuota y Renovación) */}
                        <span 
                          title={`Cuota: ${planPrice} €/mes\nRenovación: ${nextPaymentDate}`}
                          style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.18rem 0.5rem', borderRadius: 6, background: pm.bg, border: `1px solid ${pm.color}20`, color: pm.color, textTransform: 'uppercase', letterSpacing: '0.02em', flexShrink: 0, cursor: 'help' }}
                        >
                          Plan {pm.label}
                        </span>

                        {/* Saldo Org */}
                        <div style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: cBalance < 0 ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)', border: `1px solid ${cBalance < 0 ? 'rgba(248,113,113,0.12)' : 'rgba(52,211,153,0.12)'}`, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.62rem', color: 'var(--text-darker)', textTransform: 'uppercase', fontWeight: 600 }}>Saldo:</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: cBalance < 0 ? '#f87171' : '#34d399' }}>
                            {fmtBalance(cBalance)}
                          </span>
                        </div>

                        {/* Empleados + uso de cuota */}
                        {(() => {
                          const planKey = c.plan?.toLowerCase() || 'basico';
                          const limit = PLAN_LIMITS[planKey];
                          const extra = limit ? Math.max(0, empCount - limit) : 0;
                          const extraCost = extra * (PLAN_EXTRA_PRICES[planKey] ?? 0);
                          const over = extra > 0;
                          return (
                            <div style={{ padding: '0.2rem 0.5rem', borderRadius: 6, background: over ? 'rgba(251,191,36,0.07)' : 'rgba(196,181,253,0.05)', border: `1px solid ${over ? 'rgba(251,191,36,0.2)' : 'rgba(196,181,253,0.12)'}`, color: over ? '#fbbf24' : '#c4b5fd', fontSize: '0.72rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                              <Users size={12} color={over ? '#fbbf24' : '#c4b5fd'} />
                              <span>
                                {empCount}{limit ? ` / ${limit}` : ''} {empCount === 1 ? 'trabajador' : 'trabajadores'}
                                {over && <span style={{ marginLeft: 4, color: '#fbbf24' }}>· +{extraCost}€/mes</span>}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Wallet & Facturación (Saldos y Transacciones) */}
      <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 280 }}>
        
        {/* Wallet y Saldos */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
            <h2 style={{ ...sectionTitleStyle, border: 'none', margin: 0, padding: 0 }}>
              <Coins size={16} color="var(--primary-light)" /> Facturación & Wallet
            </h2>
            <button onClick={handleOpenAdjustBalance} style={actionBtnSmStyle} title="Realizar Cargo o Recarga en Wallet">
              <Euro size={12} /> Ajustar
            </button>
          </div>
          
          <div style={walletSummaryCardStyle}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Saldo Consolidado Total</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: totalConsolidated < 0 ? '#f87171' : '#34d399', marginTop: '0.2rem' }}>
              {fmtBalance(totalConsolidated)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
            <div style={balanceBreakdownRowStyle}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Wallet Personal</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: personalWallet < 0 ? '#f87171' : '#34d399' }}>{fmtBalance(personalWallet)}</span>
            </div>
            <div style={balanceBreakdownRowStyle}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Saldos de Organizaciones</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: companiesWalletTotal < 0 ? '#f87171' : '#34d399' }}>{fmtBalance(companiesWalletTotal)}</span>
            </div>

            {/* Previsión de Gastos */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={balanceBreakdownRowStyle}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Previsión de Gastos (Próx. Mes)</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{fmtBalance(nextMonthForecast)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderRadius: 8, background: isCovered ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${isCovered ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)'}` }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: isCovered ? '#34d399' : '#f87171' }}>
                  {isCovered ? 'Fondos suficientes en Wallet' : `Faltan ${(nextMonthForecast - personalWallet).toFixed(2)} €`}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.08rem 0.35rem', borderRadius: 4, background: isCovered ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)', color: isCovered ? '#34d399' : '#f87171' }}>
                  {isCovered ? 'CUBIERTO' : 'ATENCIÓN'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Últimas Transacciones */}
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}><CreditCard size={16} color="var(--primary-light)" /> Últimos Pagos / Recargas</h2>
          
          {loadingTx ? (
            <Spinner />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: '0.75rem', color: 'var(--text-darker)' }}>
                  Sin transacciones recientes en esta cuenta.
                </div>
              ) : (
                transactions.map(tx => {
                  const isCancelled = tx.invoice_status === 'cancelled';
                  const isPending   = tx.invoice_status === 'pending';
                  const isDeposit   = tx.type === 'deposit';
                  const amountColor = isCancelled ? '#475569' : isDeposit ? '#34d399' : '#f87171';
                  return (
                    <div key={tx.id} style={{ ...txRowStyle, opacity: isCancelled ? 0.55 : 1 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.description || 'Transacción de saldo'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-darker)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span>{formatDateTime(tx.created_at)}</span>
                          {tx.payment_method_details && <span>· {tx.payment_method_details}</span>}
                          {txStatusBadge(tx.invoice_status)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: amountColor, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                          {isDeposit ? '+' : '-'}{Math.abs(tx.amount_net).toFixed(2)} €
                        </span>
                        {isPending && (
                          <button
                            onClick={() => cancelTransaction(tx.id)}
                            style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171', cursor: 'pointer', letterSpacing: '0.03em' }}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {showEditProfile && (
        <div style={overlayStyle} onClick={() => setShowEditProfile(false)}>
          <div style={panelStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Editar Perfil de Soporte
              </h3>
              <button onClick={() => setShowEditProfile(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={modalLabelStyle}>Nombre Completo</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>DNI / NIE</label>
                <input
                  type="text"
                  value={profileForm.dni_nie}
                  onChange={e => setProfileForm(f => ({ ...f, dni_nie: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. 12345678Z"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Teléfono de Contacto</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. +34600123456"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Número de Seguridad Social (SSN)</label>
                <input
                  type="text"
                  value={profileForm.ss_number}
                  onChange={e => setProfileForm(f => ({ ...f, ss_number: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. 281234567890"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowEditProfile(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', borderRadius: 9, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: OPERACIÓN DE SALDO (AÑADIR / COBRAR) ── */}
      {showAdjustBalance && (
        <div style={overlayStyle} onClick={() => setShowAdjustBalance(false)}>
          <div style={panelStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Operación de Wallet Personal
              </h3>
              <button onClick={() => setShowAdjustBalance(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Selector de acción */}
              <div>
                <label style={modalLabelStyle}>Tipo de Operación</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setWalletAction('add')}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: walletAction === 'add' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${walletAction === 'add' ? '#34d399' : 'rgba(255,255,255,0.08)'}`,
                      color: walletAction === 'add' ? '#34d399' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    Añadir Saldo (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setWalletAction('charge')}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: walletAction === 'charge' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${walletAction === 'charge' ? '#f87171' : 'rgba(255,255,255,0.08)'}`,
                      color: walletAction === 'charge' ? '#f87171' : 'var(--text-muted)',
                      transition: 'all 0.15s'
                    }}
                  >
                    Cobrar / Retirar (-)
                  </button>
                </div>
              </div>

              {/* Importe */}
              <div>
                <label style={modalLabelStyle}>Importe de la Operación (€)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 700 }}>€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={walletAmount}
                    onChange={e => setWalletAmount(e.target.value)}
                    style={{ ...modalInputStyle, paddingLeft: 34 }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Concepto / Motivo */}
              <div>
                <label style={modalLabelStyle}>Concepto / Motivo de Transacción</label>
                <input
                  type="text"
                  value={walletConcept}
                  onChange={e => setWalletConcept(e.target.value)}
                  style={modalInputStyle}
                  placeholder="Ej. Compensación por incidencia o cobro por servicio"
                />
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowAdjustBalance(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveBalance}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: walletAction === 'add' ? 'linear-gradient(135deg, #10b981, #047857)' : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                    border: 'none',
                    borderRadius: 9,
                    color: 'white',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer'
                  }}
                >
                  {saving ? 'Procesando...' : walletAction === 'add' ? 'Añadir Saldo' : 'Cobrar Saldo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/* ═══════════════════════════════════════════
   VISTA: DETALLE DE ORGANIZACIÓN (EMPRESA)
   ═══════════════════════════════════════════ */
interface ViewCompanyDetailProps {
  company: Company;
  owner: Profile;
  onUpdateCompany: (updated: Company) => void;
}

const ViewCompanyDetail: React.FC<ViewCompanyDetailProps> = ({
  company,
  owner,
  onUpdateCompany
}) => {
  const [managers, setManagers] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [timeEntries, setTimeEntries] = useState<Record<string, TimeEntry>>({});
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'employees' | 'managers' | 'billing'>('employees');
  const [companyTransactions, setCompanyTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const fetchCompanyTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      if (data) setCompanyTransactions(data);
    } catch (err) {
      console.error('Error al cargar transacciones de la empresa:', err);
    } finally {
      setLoadingTx(false);
    }
  }, [company.id]);

  useEffect(() => {
    if (activeSubTab === 'billing') {
      fetchCompanyTransactions();
    }
  }, [activeSubTab, fetchCompanyTransactions]);

  // Estados para Edición de Empresa
  const [showEditCompany, setShowEditCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: company.name || '',
    fiscal_name: company.fiscal_name || '',
    cif: company.cif || '',
    plan: company.plan || 'basico'
  });

  // Estados para Gestión de Miembros
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Profile | null>(null);
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    dni_nie: '',
    ss_number: '',
    role: 'employee' as 'employee' | 'manager' | 'hr' | 'admin'
  });

  // Estados para Gestión de Fichajes (Jornadas)
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [employeeTimeEntries, setEmployeeTimeEntries] = useState<TimeEntry[]>([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);
  const [showTimeEditModal, setShowTimeEditModal] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [timeEntryForm, setTimeEntryForm] = useState({
    entry_type: 'clock-in',
    occurred_at: '',
    description: ''
  });

  const [saving, setSaving] = useState(false);
  const [accessingManager, setAccessingManager] = useState(false);

  const handleAccessAsSupport = async () => {
    setAccessingManager(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('No se detectó la sesión del usuario de Soporte.');
        setAccessingManager(false);
        return;
      }

      const { data: existing } = await supabase
        .from('company_members')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('company_members')
          .insert({
            user_id: user.id,
            company_id: company.id,
            role: 'admin',
            accepted: true
          });

        if (insertError) {
          console.error("Error linking support staff to company:", insertError);
          alert(`No se pudo vincular tu usuario a la empresa: ${insertError.message}`);
          setAccessingManager(false);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Sesión no encontrada en el cliente de Soporte.');
        setAccessingManager(false);
        return;
      }

      const managerUrl = new URL('http://localhost:3001');
      managerUrl.searchParams.set('access_token', session.access_token);
      managerUrl.searchParams.set('refresh_token', session.refresh_token);
      managerUrl.searchParams.set('impersonate_company_id', company.id);

      window.open(managerUrl.toString(), '_blank');
    } catch (err: any) {
      console.error(err);
      alert(`Error al intentar acceder a la organización: ${err.message}`);
    } finally {
      setAccessingManager(false);
    }
  };

  const fetchCompanyData = useCallback(async () => {
    setLoadingMembers(true);
    try {
      // 1. Obtener todos los perfiles vinculados a esta empresa
      const { data: members } = await supabase
        .from('profiles')
        .select('*')
        .eq('company_id', company.id);

      if (members) {
        const m: Profile[] = [];
        const e: Profile[] = [];

        members.forEach(member => {
          if (member.role === 'employee') {
            e.push(member);
          } else {
            m.push(member);
          }
        });

        // Aseguramos que el dueño aparezca en los managers
        if (!m.some(x => x.id === owner.id)) {
          m.unshift(owner);
        }

        setManagers(m);
        setEmployees(e);

        // 2. Cargar estado de fichaje activo para empleados
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const employeeIds = e.map(emp => emp.id).filter(id => uuidRegex.test(id));
        if (employeeIds.length > 0) {
          const { data: entries } = await supabase
            .from('time_entries')
            .select('id, user_id, occurred_at, entry_type, description, date, entry_time, is_manual, status')
            .in('user_id', employeeIds)
            .order('occurred_at', { ascending: false });

          if (entries) {
            const latestEntriesMap: Record<string, any> = {};
            entries.forEach((entry: any) => {
              if (!latestEntriesMap[entry.user_id]) {
                latestEntriesMap[entry.user_id] = {
                  id: entry.id,
                  user_id: entry.user_id,
                  profile_id: entry.user_id,
                  occurred_at: entry.occurred_at,
                  entry_type: entry.entry_type,
                  description: entry.description,
                  date: entry.date,
                  entry_time: entry.entry_time,
                  is_manual: entry.is_manual,
                  status: entry.status
                };
              }
            });
            setTimeEntries(latestEntriesMap);
          }
        } else {
          setTimeEntries({});
        }
      }
    } catch (err) {
      console.error('Error al cargar miembros de la empresa:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [company.id, owner]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  // --- MÉTODOS GESTIÓN EMPRESA ---
  const handleOpenEditCompany = () => {
    setCompanyForm({
      name: company.name || '',
      fiscal_name: company.fiscal_name || '',
      cif: company.cif || '',
      plan: company.plan || 'basico'
    });
    setShowEditCompany(true);
  };

  const handleSaveCompany = async () => {
    if (!companyForm.name.trim()) {
      alert('El nombre de la organización es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({
          name: companyForm.name.trim(),
          fiscal_name: companyForm.fiscal_name.trim() || null,
          cif: companyForm.cif.trim() || null,
          plan: companyForm.plan
        })
        .eq('id', company.id)
        .select()
        .single();

      if (!error && data) {
        onUpdateCompany(data);
        setShowEditCompany(false);
      } else {
        console.error('Error Supabase al actualizar empresa:', error);
        alert(`Error al guardar: ${error?.message || 'Permisos RLS insuficientes'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar para actualizar la organización.');
    } finally {
      setSaving(false);
    }
  };

  // --- MÉTODOS GESTIÓN MIEMBROS ---
  const handleOpenAddMember = () => {
    setEditingMember(null);
    setMemberForm({
      full_name: '',
      email: '',
      phone: '',
      dni_nie: '',
      ss_number: '',
      role: activeSubTab === 'employees' ? 'employee' : 'manager'
    });
    setShowMemberModal(true);
  };

  const handleOpenEditMember = (member: Profile) => {
    setEditingMember(member);
    setMemberForm({
      full_name: member.full_name || '',
      email: member.email || '',
      phone: member.phone || '',
      dni_nie: member.dni_nie || '',
      ss_number: member.ss_number || '',
      role: (member.role as any) || 'employee'
    });
    setShowMemberModal(true);
  };

  const handleSaveMember = async () => {
    if (!memberForm.full_name.trim()) {
      alert('El nombre completo es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      if (editingMember) {
        // Modificar miembro
        const { error: errorProfile } = await supabase
          .from('profiles')
          .update({
            full_name: memberForm.full_name.trim(),
            email: memberForm.email.trim() || null,
            phone: memberForm.phone.trim() || null,
            dni_nie: memberForm.dni_nie.trim() || null,
            ss_number: memberForm.ss_number.trim() || null,
            role: memberForm.role
          })
          .eq('id', editingMember.id);

        if (errorProfile) throw errorProfile;

        // Actualizar tabla relacional company_members
        await supabase
          .from('company_members')
          .update({ role: memberForm.role })
          .eq('user_id', editingMember.id)
          .eq('company_id', company.id);

        setShowMemberModal(false);
        fetchCompanyData();
      } else {
        // Crear/Vincular miembro
        const emailTrimmed = memberForm.email.trim();
        let userId = '';

        if (emailTrimmed) {
          // Buscar si ya existe por email
          const { data: existing } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', emailTrimmed)
            .maybeSingle();

          if (existing) {
            userId = existing.id;
            if (existing.company_id && existing.company_id !== company.id) {
              const confirmLink = window.confirm(`Este usuario pertenece a otra organización. ¿Deseas asociarlo a ${company.name}?`);
              if (!confirmLink) {
                setSaving(false);
                return;
              }
            }
            // Vincular perfil
            await supabase
              .from('profiles')
              .update({
                company_id: company.id,
                role: memberForm.role,
                full_name: memberForm.full_name.trim(),
                phone: memberForm.phone.trim() || existing.phone,
                dni_nie: memberForm.dni_nie.trim() || existing.dni_nie,
                ss_number: memberForm.ss_number.trim() || existing.ss_number
              })
              .eq('id', userId);
          }
        }

        if (!userId) {
          // Crear perfil desde cero
          userId = crypto.randomUUID();
          const { error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              full_name: memberForm.full_name.trim(),
              email: emailTrimmed || null,
              phone: memberForm.phone.trim() || null,
              dni_nie: memberForm.dni_nie.trim() || null,
              ss_number: memberForm.ss_number.trim() || null,
              company_id: company.id,
              role: memberForm.role,
              created_at: new Date().toISOString()
            });

          if (createError) throw createError;
        }

        // Registrar en company_members
        const { error: linkError } = await supabase
          .from('company_members')
          .insert({
            user_id: userId,
            company_id: company.id,
            role: memberForm.role,
            accepted: true
          });

        if (linkError && linkError.code !== '23505') {
          console.warn('Fallo en inserción de company_members:', linkError);
        }

        setShowMemberModal(false);
        fetchCompanyData();
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar miembro: ${err.message || 'Permisos RLS insuficientes'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkMember = async (member: Profile) => {
    const confirmVal = window.confirm(`¿Estás seguro de que deseas desvincular a ${member.full_name} de esta organización?`);
    if (!confirmVal) return;

    try {
      await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('id', member.id);

      await supabase
        .from('company_members')
        .delete()
        .eq('user_id', member.id)
        .eq('company_id', company.id);

      fetchCompanyData();
    } catch (err) {
      console.error(err);
      alert('Error al desvincular miembro de la organización.');
    }
  };

  // --- MÉTODOS GESTIÓN FICHAJES ---
  const fetchTimeEntries = async (empId: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(empId)) {
      setEmployeeTimeEntries([]);
      return;
    }
    setLoadingTimeEntries(true);
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .eq('user_id', empId)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEmployeeTimeEntries(data || []);
    } catch (err) {
      console.error('Error al cargar fichajes:', err);
    } finally {
      setLoadingTimeEntries(false);
    }
  };

  const handleOpenTimeModal = (emp: Profile) => {
    setSelectedEmployee(emp);
    setEmployeeTimeEntries([]);
    setShowTimeModal(true);
    fetchTimeEntries(emp.id);
  };

  const handleOpenTimeAdd = () => {
    setEditingTimeEntry(null);
    const nowIso = new Date().toISOString().slice(0, 16);
    setTimeEntryForm({
      entry_type: 'clock-in',
      occurred_at: nowIso,
      description: ''
    });
    setShowTimeEditModal(true);
  };

  const handleOpenTimeEdit = (entry: TimeEntry) => {
    setEditingTimeEntry(entry);
    setTimeEntryForm({
      entry_type: entry.entry_type || 'clock-in',
      occurred_at: entry.occurred_at ? new Date(entry.occurred_at).toISOString().slice(0, 16) : '',
      description: entry.description || ''
    });
    setShowTimeEditModal(true);
  };

  const handleSaveTimeEntry = async () => {
    if (!selectedEmployee) return;
    if (!timeEntryForm.occurred_at) {
      alert('La fecha y hora es obligatoria.');
      return;
    }

    const occurredDate = new Date(timeEntryForm.occurred_at).toISOString();
    const defaultLabel = timeEntryForm.entry_type === 'clock-in' ? 'Entrada trabajo'
      : timeEntryForm.entry_type === 'clock-out' ? 'Salida trabajo'
      : timeEntryForm.entry_type === 'break-start' ? 'Inicio descanso'
      : 'Fin descanso';

    setSaving(true);
    try {
      if (editingTimeEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update({
            entry_type: timeEntryForm.entry_type,
            occurred_at: occurredDate,
            description: timeEntryForm.description.trim() || defaultLabel
          })
          .eq('id', editingTimeEntry.id);

        if (error) throw error;
      } else {
        const dateStr = occurredDate.split('T')[0];
        const timeStr = new Date(occurredDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const { error } = await supabase
          .from('time_entries')
          .insert({
            user_id: selectedEmployee.id,
            company_id: company.id,
            entry_type: timeEntryForm.entry_type,
            occurred_at: occurredDate,
            date: dateStr,
            entry_time: timeStr,
            description: timeEntryForm.description.trim() || defaultLabel,
            is_manual: true
          });

        if (error) throw error;
      }

      setShowTimeEditModal(false);
      fetchTimeEntries(selectedEmployee.id);
      fetchCompanyData();
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar fichaje: ${err.message || 'Permisos RLS insuficientes'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    const confirmVal = window.confirm('¿Estás seguro de que deseas eliminar este fichaje?');
    if (!confirmVal) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
      if (selectedEmployee) {
        fetchTimeEntries(selectedEmployee.id);
      }
      fetchCompanyData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar fichaje.');
    }
  };

  const pm = planMeta(company.plan);
  const companyBalance = company.wallet_balance !== undefined ? company.wallet_balance : (company.balance ?? 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      
      {/* Columna Izquierda: Ficha de la Empresa */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: pm.bg, border: `1px solid ${pm.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={32} color={pm.color} />
            </div>
          </div>

          <h3 style={{ textAlign: 'center', color: 'var(--text-main)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.25rem' }}>
            {company.name}
          </h3>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 6, background: pm.bg, border: `1px solid ${pm.color}25`, color: pm.color }}>
              PLAN {pm.label.toUpperCase()}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
            <DetailItem label="Razón Fiscal" value={company.fiscal_name || '—'} />
            <DetailItem label="CIF / NIF" value={company.cif || '—'} />
            <DetailItem label="Saldo Disponible" value={fmtBalance(companyBalance)} color={companyBalance < 0 ? '#f87171' : '#34d399'} />
            <DetailItem label="Fecha de Registro" value={formatDate(company.created_at)} />
            <DetailItem label="Dueño (Propietario)" value={owner.full_name} />
            
            <button onClick={handleOpenEditCompany} style={{ ...actionBtnSt, width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
              <Pencil size={12} /> Editar Organización
            </button>
            <button 
              onClick={handleAccessAsSupport} 
              disabled={accessingManager}
              style={{ ...actionBtnSt, width: '100%', justifyContent: 'center', marginTop: '0.25rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white', fontWeight: 600 }}
            >
              <Smartphone size={12} /> {accessingManager ? 'Accediendo...' : 'Acceder al Manager'}
            </button>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Tabs de Managers y Empleados */}
      <div style={cardStyle}>
        
        {/* Cabecera Sub-tabs + Añadir */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.25rem' }}>
          <div style={subTabsContainerStyle}>
            <button
              onClick={() => setActiveSubTab('employees')}
              style={{
                ...subTabButtonStyle,
                color: activeSubTab === 'employees' ? 'var(--primary-light, #c4b5fd)' : 'var(--text-muted)',
                borderBottomColor: activeSubTab === 'employees' ? 'var(--primary, #8b5cf6)' : 'transparent',
                fontWeight: activeSubTab === 'employees' ? 600 : 500,
              }}
            >
              <Smartphone size={15} /> Empleados ({employees.length})
            </button>
            <button
              onClick={() => setActiveSubTab('managers')}
              style={{
                ...subTabButtonStyle,
                color: activeSubTab === 'managers' ? 'var(--primary-light, #c4b5fd)' : 'var(--text-muted)',
                borderBottomColor: activeSubTab === 'managers' ? 'var(--primary, #8b5cf6)' : 'transparent',
                fontWeight: activeSubTab === 'managers' ? 600 : 500,
              }}
            >
              <UserCheck size={15} /> Managers y Admins ({managers.length})
            </button>
            <button
              onClick={() => setActiveSubTab('billing')}
              style={{
                ...subTabButtonStyle,
                color: activeSubTab === 'billing' ? 'var(--primary-light, #c4b5fd)' : 'var(--text-muted)',
                borderBottomColor: activeSubTab === 'billing' ? 'var(--primary, #8b5cf6)' : 'transparent',
                fontWeight: activeSubTab === 'billing' ? 600 : 500,
              }}
            >
              <CreditCard size={15} /> Facturación ({fmtBalance(companyBalance)})
            </button>
          </div>

          {activeSubTab !== 'billing' && (
            <button onClick={handleOpenAddMember} style={actionBtnSmStyle}>
              <Plus size={12} /> Añadir {activeSubTab === 'employees' ? 'Empleado' : 'Administrador'}
            </button>
          )}
        </div>

        {/* Contenido de la lista */}
        {loadingMembers ? (
          <Spinner />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem', marginTop: '1rem' }}>
            
            {/* TAB EMPLEADOS */}
            {activeSubTab === 'employees' && (
              <>
                {employees.length === 0 ? (
                  <Empty text="No hay perfiles de empleados registrados para esta empresa." />
                ) : (
                  employees.map(emp => {
                    const latestEntry = timeEntries[emp.id];
                    const activeCheckIn = latestEntry && ['clock-in', 'break-end', 'others-in'].includes(latestEntry.entry_type ?? '');
                    return (
                      <div key={emp.id} style={innerRowStyle}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: activeCheckIn ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.1)', border: `1px solid ${activeCheckIn ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Smartphone size={16} color={activeCheckIn ? '#34d399' : '#6b7280'} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>{emp.full_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-darker)', display: 'flex', gap: '8px' }}>
                            <span>DNI: {emp.dni_nie || '—'}</span>
                            {emp.email && <span>• {emp.email}</span>}
                          </div>
                        </div>

                        {/* Estado Fichaje + Acciones */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-end' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 100, justifyContent: 'flex-end' }}>
                            {activeCheckIn ? (
                              <>
                                <span style={greenPulseStyle} />
                                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600 }}>Fichado</span>
                              </>
                            ) : latestEntry ? (
                              <>
                                <Clock size={12} color="var(--text-darker)" />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={`Última acción: ${latestEntry.entry_type ?? ''}`}>
                                  {formatDateTime(latestEntry.occurred_at ?? '')}
                                </span>
                              </>
                            ) : (
                              <>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b7280' }} />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-darker)' }}>Sin actividad</span>
                              </>
                            )}
                          </div>

                          {/* Botones de acción */}
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={() => handleOpenTimeModal(emp)} style={actionBtnIconStyle} title="Ver y Editar Fichajes (Jornadas)">
                              <History size={13} color="var(--text-muted)" />
                            </button>
                            <button onClick={() => handleOpenEditMember(emp)} style={actionBtnIconStyle} title="Editar Datos del Empleado">
                              <Pencil size={13} color="var(--text-muted)" />
                            </button>
                            <button onClick={() => handleUnlinkMember(emp)} style={actionBtnIconDestructiveStyle} title="Desvincular Empleado">
                              <Trash2 size={13} color="#f87171" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* TAB MANAGERS */}
            {activeSubTab === 'managers' && (
              <>
                {managers.length === 0 ? (
                  <Empty text="No hay administradores asociados." />
                ) : (
                  managers.map(mgr => {
                    const isOwner = mgr.id === owner.id;
                    return (
                      <div key={mgr.id} style={innerRowStyle}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: isOwner ? 'rgba(139,92,246,0.12)' : 'rgba(59,130,246,0.1)', border: `1px solid ${isOwner ? 'rgba(139,92,246,0.2)' : 'rgba(59,130,246,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserCheck size={16} color={isOwner ? '#a78bfa' : '#60a5fa'} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {mgr.full_name}
                            {isOwner && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.08rem 0.35rem', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                                Propietario
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-darker)', display: 'flex', gap: '8px' }}>
                            <span>Rol: {mgr.role?.toUpperCase() || 'MANAGER'}</span>
                            {mgr.email && <span>• {mgr.email}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>
                            Alta {formatDate(mgr.created_at)}
                          </div>
                          
                          {!isOwner && (
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button onClick={() => handleOpenEditMember(mgr)} style={actionBtnIconStyle} title="Editar Datos del Manager">
                                <Pencil size={13} color="var(--text-muted)" />
                              </button>
                              <button onClick={() => handleUnlinkMember(mgr)} style={actionBtnIconDestructiveStyle} title="Desvincular Manager">
                                <Trash2 size={13} color="#f87171" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* TAB FACTURACIÓN Y PAGOS */}
            {activeSubTab === 'billing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
                
                {/* Detalles del Plan */}
                <div style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 10, padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: pm.bg, border: `1px solid ${pm.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={20} color={pm.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Suscripción {pm.label}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Cuota de {PLAN_PRICES[company.plan?.toLowerCase() || 'basico'] ?? 0} €/mes
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: 2 }}>
                      Próxima Renovación
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#34d399' }}>
                      {(() => {
                        if (!company.created_at) return '—';
                        const created = new Date(company.created_at);
                        const now = new Date();
                        let nextDate = new Date(now.getFullYear(), now.getMonth(), created.getDate());
                        if (nextDate < now) {
                          nextDate.setMonth(nextDate.getMonth() + 1);
                        }
                        return nextDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                      })()}
                    </span>
                  </div>
                </div>

                {/* Historial de Pagos de la Empresa */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.4rem' }}>
                    Historial de Pagos y Movimientos
                  </h4>

                  {loadingTx ? (
                    <Spinner />
                  ) : companyTransactions.length === 0 ? (
                    <Empty text="No se han registrado transacciones de pago o recargas para esta empresa." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 300, overflowY: 'auto', paddingRight: '4px' }}>
                      {companyTransactions.map(tx => {
                        const isDeposit = tx.type === 'deposit';
                        return (
                          <div key={tx.id} style={{ ...innerRowStyle, padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.01)', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tx.description}>
                                {tx.description || 'Movimiento de saldo'}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-darker)', marginTop: 3, display: 'flex', gap: '10px' }}>
                                <span>{formatDateTime(tx.created_at)}</span>
                                {tx.payment_method_details && <span>• {tx.payment_method_details}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isDeposit ? '#34d399' : '#f87171' }}>
                                {isDeposit ? '+' : '-'}{Math.abs(tx.amount_net).toFixed(2)} €
                              </span>
                              {(tx as any).invoice_number ? (
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  Factura: {(tx as any).invoice_number}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}
      </div>

      {showEditCompany && (
        <div style={overlayStyle} onClick={() => setShowEditCompany(false)}>
          <div style={panelStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Editar Organización
              </h3>
              <button onClick={() => setShowEditCompany(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={modalLabelStyle}>Nombre de la Organización</label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. Mi Empresa S.L."
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Razón Fiscal</label>
                <input
                  type="text"
                  value={companyForm.fiscal_name}
                  onChange={e => setCompanyForm(f => ({ ...f, fiscal_name: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. Mi Empresa de Servicios S.L."
                />
              </div>

              <div>
                <label style={modalLabelStyle}>CIF / NIF</label>
                <input
                  type="text"
                  value={companyForm.cif}
                  onChange={e => setCompanyForm(f => ({ ...f, cif: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. B12345678"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Plan de Suscripción</label>
                <select
                  value={companyForm.plan}
                  onChange={e => setCompanyForm(f => ({ ...f, plan: e.target.value }))}
                  style={modalInputStyle}
                >
                  <option value="gratis">Gratis (0 €/mes)</option>
                  <option value="basico">Básico (15 €/mes)</option>
                  <option value="pro15">Pro 15 (29 €/mes)</option>
                  <option value="pro30">Pro 30 (59 €/mes)</option>
                  <option value="pro60">Pro 60 (99 €/mes)</option>
                  <option value="pro100">Pro 100 (149 €/mes)</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowEditCompany(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveCompany}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', borderRadius: 9, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR MIEMBRO DE LA EMPRESA ── */}
      {showMemberModal && (
        <div style={overlayStyle} onClick={() => setShowMemberModal(false)}>
          <div style={panelStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                {editingMember ? 'Editar Datos del Miembro' : `Añadir Nuevo ${memberForm.role === 'employee' ? 'Empleado' : 'Administrador'}`}
              </h3>
              <button onClick={() => setShowMemberModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={modalLabelStyle}>Nombre Completo</label>
                <input
                  type="text"
                  value={memberForm.full_name}
                  onChange={e => setMemberForm(f => ({ ...f, full_name: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. María Gómez"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Correo Electrónico</label>
                <input
                  type="email"
                  value={memberForm.email}
                  disabled={!!editingMember}
                  onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))}
                  style={{ ...modalInputStyle, background: editingMember ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', cursor: editingMember ? 'not-allowed' : 'text' }}
                  placeholder="Ej. maria@empresa.com"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Teléfono</label>
                <input
                  type="text"
                  value={memberForm.phone}
                  onChange={e => setMemberForm(f => ({ ...f, phone: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. +34600000000"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>DNI / NIE</label>
                <input
                  type="text"
                  value={memberForm.dni_nie}
                  onChange={e => setMemberForm(f => ({ ...f, dni_nie: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. 12345678A"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Número de Seguridad Social (SSN)</label>
                <input
                  type="text"
                  value={memberForm.ss_number}
                  onChange={e => setMemberForm(f => ({ ...f, ss_number: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. 281234567890"
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Rol / Privilegio</label>
                <select
                  value={memberForm.role}
                  onChange={e => setMemberForm(f => ({ ...f, role: e.target.value as any }))}
                  style={modalInputStyle}
                >
                  <option value="employee">Empleado (Fichaje en App y Kiosko)</option>
                  <option value="manager">Manager de Equipo</option>
                  <option value="hr">Recursos Humanos (RRHH)</option>
                  <option value="admin">Administrador (Gestor de Cuenta)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowMemberModal(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveMember}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', borderRadius: 9, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Procesando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: HISTORIAL DE JORNADAS Y FICHAJES (EMPLEADO) ── */}
      {showTimeModal && selectedEmployee && (
        <div style={overlayStyle} onClick={() => setShowTimeModal(false)}>
          <div style={{ ...panelStyle, maxWidth: 550 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                  Fichajes de {selectedEmployee.full_name}
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)' }}>Últimos 50 registros de la base de datos</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={handleOpenTimeAdd} style={actionBtnSmStyle}>
                  <Plus size={12} /> Fichar Manual
                </button>
                <button onClick={() => setShowTimeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {loadingTimeEntries ? (
              <Spinner />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 350, overflowY: 'auto', paddingRight: '4px', marginTop: '1rem' }}>
                {employeeTimeEntries.length === 0 ? (
                  <Empty text="No hay fichajes registrados para este empleado." />
                ) : (
                  employeeTimeEntries.map(entry => {
                    return (
                      <div key={entry.id} style={{ ...innerRowStyle, padding: '0.6rem 0.8rem', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.015)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 600 }}>
                            {new Date(entry.occurred_at ?? '').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(entry.occurred_at ?? '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            {' • '}
                            <span style={{
                              fontWeight: 700,
                              color: entry.entry_type === 'clock-in' ? '#34d399' 
                                : entry.entry_type === 'clock-out' ? '#9ca3af'
                                : entry.entry_type === 'break-start' ? '#f59e0b'
                                : '#60a5fa'
                            }}>
                              {entry.entry_type === 'clock-in' ? 'ENTRADA'
                                : entry.entry_type === 'clock-out' ? 'SALIDA'
                                : entry.entry_type === 'break-start' ? 'INI DESCANSO'
                                : 'FIN DESCANSO'}
                            </span>
                          </span>
                          {entry.description && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-darker)' }}>
                              {entry.description}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button onClick={() => handleOpenTimeEdit(entry)} style={actionBtnIconStyle} title="Editar Jornada">
                              <Pencil size={11} color="var(--text-muted)" />
                            </button>
                            <button onClick={() => handleDeleteTimeEntry(entry.id)} style={actionBtnIconDestructiveStyle} title="Eliminar Jornada">
                              <Trash2 size={11} color="#f87171" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: EDITAR/CREAR FICHAJE ESPECÍFICO ── */}
      {showTimeEditModal && (
        <div style={{ ...overlayStyle, zIndex: 1100 }} onClick={() => setShowTimeEditModal(false)}>
          <div style={{ ...panelStyle, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '1.1rem', color: 'var(--text-main)', fontWeight: 700 }}>
                {editingTimeEntry ? 'Editar Registro de Fichaje' : 'Crear Fichaje Manual'}
              </h3>
              <button onClick={() => setShowTimeEditModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={modalLabelStyle}>Tipo de Fichaje</label>
                <select
                  value={timeEntryForm.entry_type}
                  onChange={e => setTimeEntryForm(f => ({ ...f, entry_type: e.target.value }))}
                  style={modalInputStyle}
                >
                  <option value="clock-in">Entrada (Clock-in)</option>
                  <option value="clock-out">Salida (Clock-out)</option>
                  <option value="break-start">Inicio Descanso</option>
                  <option value="break-end">Fin Descanso</option>
                </select>
              </div>

              <div>
                <label style={modalLabelStyle}>Fecha y Hora</label>
                <input
                  type="datetime-local"
                  value={timeEntryForm.occurred_at}
                  onChange={e => setTimeEntryForm(f => ({ ...f, occurred_at: e.target.value }))}
                  style={modalInputStyle}
                />
              </div>

              <div>
                <label style={modalLabelStyle}>Concepto / Descripción</label>
                <input
                  type="text"
                  value={timeEntryForm.description}
                  onChange={e => setTimeEntryForm(f => ({ ...f, description: e.target.value }))}
                  style={modalInputStyle}
                  placeholder="Ej. Fichaje manual de soporte"
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => setShowTimeEditModal(false)}
                  style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 9, color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTimeEntry}
                  disabled={saving}
                  style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none', borderRadius: 9, color: 'white', fontSize: '0.9rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Procesando...' : 'Guardar Fichaje'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/* ── COMPONENTES REUTILIZABLES ── */
function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <div style={{ width: 32, height: 32, border: '3px solid rgba(139,92,246,0.15)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-darker)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.01)', borderRadius: 10 }}>
      {text}
    </div>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-darker)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
      <span style={{ fontSize: '0.85rem', color: color || 'var(--text-main)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/* ── ESTILOS CSS EN LINEA ── */
const breadcrumbsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '0.8rem',
  color: 'var(--text-muted)'
};

const breadcrumbItemStyle: React.CSSProperties = {
  transition: 'color 0.2s',
  userSelect: 'none'
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  background: 'rgba(21,27,43,0.5)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
  padding: '0.75rem 1rem',
};

const inputSt: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem 0.875rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: 'var(--text-main)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const iconBtnSt: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  background: 'rgba(21,27,43,0.4)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 12,
  padding: '0.875rem 1rem',
  transition: 'transform 0.2s, background-color 0.2s'
};

const innerRowStyle: React.CSSProperties = {
  display: 'flex',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 12,
  padding: '0.875rem 1rem',
  transition: 'all 0.2s ease-in-out',
};

const avatarCircleStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  background: 'rgba(139,92,246,0.12)',
  border: '1px solid rgba(139,92,246,0.2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};

const actionBtnSt: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
  padding: '0.45rem 0.85rem',
  background: 'rgba(139,92,246,0.1)',
  border: '1px solid rgba(139,92,246,0.2)',
  borderRadius: 7,
  color: '#c4b5fd',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const actionBtnSmStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.2rem',
  padding: '0.3rem 0.6rem',
  background: 'rgba(139,92,246,0.1)',
  border: '1px solid rgba(139,92,246,0.18)',
  borderRadius: 6,
  color: '#c4b5fd',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s'
};

const backBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.45rem 0.85rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: 'var(--text-muted)',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'color 0.2s'
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(21,27,43,0.4)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 14,
  padding: '1.5rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 700,
  color: 'var(--text-main)',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '0.75rem',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  paddingBottom: '0.5rem'
};

const walletSummaryCardStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
  border: '1px solid rgba(139,92,246,0.22)',
  borderRadius: 12,
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginTop: '0.5rem'
};

const balanceBreakdownRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.5rem 0.75rem',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 8
};

const txRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.6rem 0.75rem',
  background: 'rgba(255,255,255,0.01)',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
};

const subTabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  gap: '1rem'
};

const subTabButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  padding: '0.75rem 0.25rem',
  fontSize: '0.85rem',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  transition: 'all 0.2s'
};

const greenPulseStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: '#10b981',
  boxShadow: '0 0 6px #10b981',
  animation: 'pulse 1.5s infinite'
};

/* ── ESTILOS ADICIONALES PARA MODALES DE CRISTAL ── */
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 1000,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(5px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const panelStyle: React.CSSProperties = {
  background: '#111522',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16,
  padding: '1.75rem',
  width: '100%',
  maxWidth: 460,
  boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
};

const modalLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const modalInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  color: 'var(--text-main)',
  fontSize: '0.88rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const actionBtnIconStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 6,
  cursor: 'pointer',
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s'
};

const actionBtnIconDestructiveStyle: React.CSSProperties = {
  background: 'rgba(248,113,113,0.04)',
  border: '1px solid rgba(248,113,113,0.12)',
  borderRadius: 6,
  cursor: 'pointer',
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s'
};

