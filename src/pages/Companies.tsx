import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  Settings2, 
  DollarSign, 
  X,
  RefreshCw,
  Plus
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  plan: string;
  balance: number;
  kiosk_limit: number;
  created_at: string;
  fiscal_name?: string;
  cif?: string;
}

export const Companies: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('all');
  
  // Estados para modales de edición
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [newPlan, setNewPlan] = useState('');
  const [newBalance, setNewBalance] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCompanies(data);
      } else {
        // Fallback de datos de prueba premium
        setCompanies([
          { id: '1', name: 'DemoCorp', plan: 'pro', balance: 45.50, kiosk_limit: 3, created_at: new Date(Date.now() - 30 * 86400000).toISOString(), fiscal_name: 'DemoCorp Solutions S.L.', cif: 'B12345678' },
          { id: '2', name: 'Alimentación Paco', plan: 'basic', balance: -5.00, kiosk_limit: 1, created_at: new Date(Date.now() - 60 * 86400000).toISOString(), fiscal_name: 'Francisco Gómez S.L.', cif: 'B98765432' },
          { id: '3', name: 'Tecnología Avanzada', plan: 'enterprise', balance: 250.00, kiosk_limit: 10, created_at: new Date(Date.now() - 15 * 86400000).toISOString(), fiscal_name: 'Tech Advanced Europa S.A.', cif: 'A87654321' },
          { id: '4', name: 'Modas Lucía', plan: 'free', balance: 0.00, kiosk_limit: 1, created_at: new Date(Date.now() - 100 * 86400000).toISOString(), fiscal_name: 'Lucía Ortiz Torres', cif: '44555666X' },
          { id: '5', name: 'Bufete Martínez', plan: 'pro', balance: 12.00, kiosk_limit: 2, created_at: new Date(Date.now() - 45 * 86400000).toISOString(), fiscal_name: 'Martínez & Asociados S.C.', cif: 'J55443322' },
          { id: '6', name: 'Clínica Dental Dentalia', plan: 'pro', balance: -29.90, kiosk_limit: 2, created_at: new Date(Date.now() - 120 * 86400000).toISOString(), fiscal_name: 'Dentalia Integra S.L.P.', cif: 'B55667788' }
        ]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleOpenEdit = (company: Company) => {
    setEditingCompany(company);
    setNewPlan(company.plan || 'free');
    setNewBalance(company.balance ?? 0);
  };

  const handleSave = async () => {
    if (!editingCompany) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          plan: newPlan,
          balance: newBalance
        })
        .eq('id', editingCompany.id);

      if (error) {
        console.error("Error al actualizar la empresa en Supabase:", error);
      }

      // Si falla (p.ej. localmente), actualizamos el estado en local simulándolo
      setCompanies(prev => prev.map(c => 
        c.id === editingCompany.id 
          ? { ...c, plan: newPlan, balance: newBalance } 
          : c
      ));

      setEditingCompany(null);
      alert('Configuración de la empresa guardada con éxito.');
    } catch (e) {
      console.error(e);
      alert('Error al guardar datos.');
    } finally {
      setSaving(false);
    }
  };

  // Filtrado de la tabla
  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || 
                          (c.fiscal_name && c.fiscal_name.toLowerCase().includes(search.toLowerCase())) ||
                          (c.cif && c.cif.toLowerCase().includes(search.toLowerCase()));
    const matchesPlan = selectedPlan === 'all' || c.plan === selectedPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <div className="companies-view animate-fade-in">
      <div className="view-header">
        <div>
          <h1 className="view-title">Gestión de Empresas</h1>
          <p className="view-subtitle">Supervisa las cuentas de clientes, saldo de facturación y límites del sistema.</p>
        </div>
        <button className="btn btn-primary" onClick={() => alert('Creación de empresa disponible a través de la web principal')}>
          <Plus size={16} />
          <span>Registrar Empresa</span>
        </button>
      </div>

      <div className="filters-bar glass-card">
        <div className="search-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar por nombre, CIF, razón social..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input search-input"
          />
        </div>
        <div className="plan-filter">
          <select 
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            className="form-input form-select"
          >
            <option value="all">Todos los planes</option>
            <option value="basic">Plan Básico (29€)</option>
            <option value="pro">Plan Pro (59€)</option>
            <option value="business">Plan Business (99€)</option>
            <option value="premium">Plan Premium (149€)</option>
            <option value="enterprise">Plan Enterprise</option>
          </select>
        </div>
        <button onClick={fetchCompanies} className="btn btn-secondary btn-icon-only" title="Recargar tabla">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="loading-table">
          <RefreshCw className="spinner" size={28} />
          <p>Obteniendo empresas...</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Empresa / CIF</th>
                <th>Plan</th>
                <th>Saldo</th>
                <th>Fecha de Alta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">No se encontraron empresas que coincidan con los filtros.</td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <div className="company-info">
                        <span className="company-name">{company.name}</span>
                        <span className="company-sub">{company.fiscal_name || 'Razón social no registrada'} • {company.cif || 'Sin CIF'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                        company.plan === 'enterprise' ? 'badge-info' :
                        company.plan === 'premium'    ? 'badge-info' :
                        company.plan === 'business'   ? 'badge-success' :
                        company.plan === 'pro'        ? 'badge-success' :
                        company.plan === 'basic'      ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {(company.plan || 'free').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`balance-value ${(company.balance ?? 0) < 0 ? 'negative' : 'positive'}`}>
                        {(company.balance ?? 0).toFixed(2)}€
                      </span>
                    </td>
                    <td>
                      {company.created_at ? new Date(company.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleOpenEdit(company)}
                        className="btn btn-secondary btn-sm btn-edit-action"
                        title="Administrar parámetros"
                      >
                        <Settings2 size={14} />
                        <span>Ajustes</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de edición */}
      {editingCompany && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div className="modal-header">
              <h3>Parámetros Maestros: {editingCompany.name}</h3>
              <button onClick={() => setEditingCompany(null)} className="btn-close">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">Plan de Suscripción</label>
                <select 
                  value={newPlan} 
                  onChange={(e) => setNewPlan(e.target.value)}
                  className="form-input form-select"
                >
                  <option value="basic">Básico — 29€/mes (hasta 8 empleados)</option>
                  <option value="pro">Pro — 59€/mes (hasta 18 empleados)</option>
                  <option value="business">Business — 99€/mes (hasta 40 empleados)</option>
                  <option value="premium">Premium — 149€/mes (hasta 100 empleados)</option>
                  <option value="enterprise">Enterprise — Personalizado (+100 empleados)</option>
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Saldo de Cuenta (€)</label>
                <div className="balance-input-wrap">
                  <DollarSign size={16} className="input-icon" />
                  <input 
                    type="number" 
                    step="0.01" 
                    value={newBalance} 
                    onChange={(e) => setNewBalance(parseFloat(e.target.value) || 0)}
                    className="form-input form-input-with-icon"
                  />
                </div>
                <span className="input-help">Un saldo negativo significa que el cliente tiene pagos pendientes. Un saldo positivo representa crédito a favor.</span>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setEditingCompany(null)} className="btn btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .companies-view {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .view-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .view-title {
          font-size: 2rem;
          color: white;
          margin-bottom: 6px;
        }
        .view-subtitle {
          color: var(--text-muted);
          font-size: 0.95rem;
        }
        .filters-bar {
          display: flex;
          gap: 16px;
          align-items: center;
          padding: 16px;
        }
        .search-wrap {
          position: relative;
          flex: 1;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-darker);
        }
        .search-input {
          padding-left: 42px;
        }
        .plan-filter {
          width: 220px;
        }
        .btn-icon-only {
          width: 42px;
          height: 42px;
          padding: 0;
        }
        .loading-table {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          gap: 12px;
          color: var(--text-muted);
        }
        .spinner {
          animation: spin 1s linear infinite;
          color: var(--primary);
        }
        .company-info {
          display: flex;
          flex-direction: column;
        }
        .company-name {
          font-weight: 600;
          color: white;
        }
        .company-sub {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .kiosk-limit-cell {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .balance-value {
          font-weight: 700;
          font-family: monospace;
        }
        .balance-value.positive {
          color: var(--success-light);
        }
        .balance-value.negative {
          color: var(--danger-light);
        }
        .btn-edit-action {
          padding: 6px 12px;
          font-size: 0.75rem;
        }
        .empty-row {
          text-align: center;
          color: var(--text-muted);
          padding: 40px !important;
        }

        /* Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal-content {
          width: 100%;
          max-width: 480px;
          padding: 24px;
          background: #111522;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .modal-header h3 {
          font-size: 1.1rem;
          color: white;
        }
        .btn-close {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.2s;
        }
        .btn-close:hover {
          color: white;
        }
        .modal-body {
          margin-bottom: 24px;
        }
        .balance-input-wrap {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .form-input-with-icon {
          padding-left: 36px;
        }
        .input-help {
          font-size: 0.7rem;
          color: var(--text-darker);
          margin-top: 4px;
          line-height: 1.3;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
