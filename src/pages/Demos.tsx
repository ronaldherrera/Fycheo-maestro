import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  UserCheck, 
  Eye, 
  Laptop, 
  Smartphone, 
  Tablet, 
  HelpCircle,
  Globe,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { supabaseDemo } from '../lib/supabase';

interface DemoAccess {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  created_at: string;
}

interface DemoVisit {
  id: string;
  email: string;
  visited_at: string;
  device_type: string | null;
  user_agent: string | null;
}

interface DemoEvent {
  id: string;
  email: string;
  section: string;
  created_at: string;
}

export const Demos: React.FC = () => {
  const [accessList, setAccessList] = useState<DemoAccess[]>([]);
  const [visitsList, setVisitsList] = useState<DemoVisit[]>([]);
  const [eventsList, setEventsList] = useState<DemoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Formulario de nuevo acceso
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Carga de datos
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Cargar accesos
      const { data: accessData, error: accessErr } = await supabaseDemo
        .from('demo_access')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (accessErr) throw accessErr;
      setAccessList(accessData || []);

      // 2. Cargar visitas
      const { data: visitsData, error: visitsErr } = await supabaseDemo
        .from('demo_visits')
        .select('*')
        .order('visited_at', { ascending: false })
        .limit(50);
        
      if (visitsErr) throw visitsErr;
      setVisitsList(visitsData || []);

      // 3. Cargar eventos de sección
      const { data: eventsData, error: eventsErr } = await supabaseDemo
        .from('demo_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
        
      if (eventsErr) throw eventsErr;
      setEventsList(eventsData || []);

    } catch (err: any) {
      console.error("[Demos] Error fetching data:", err);
      setErrorMsg(err.message || "Error al conectar con la base de datos de la demo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Configurar suscripciones Realtime (si están habilitadas en Supabase)
    const channelAccess = supabaseDemo
      .channel('demo_access_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demo_access' }, () => {
        fetchData();
      })
      .subscribe();

    const channelVisits = supabaseDemo
      .channel('demo_visits_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_visits' }, () => {
        fetchData();
      })
      .subscribe();

    const channelEvents = supabaseDemo
      .channel('demo_events_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'demo_events' }, () => {
        fetchData();
      })
      .subscribe();

    // Refresco periódico secundario (cada 15 segundos) por si Realtime no está activo en DDBB
    const interval = setInterval(fetchData, 15000);

    return () => {
      clearInterval(interval);
      supabaseDemo.removeChannel(channelAccess);
      supabaseDemo.removeChannel(channelVisits);
      supabaseDemo.removeChannel(channelEvents);
    };
  }, []);

  // Agregar acceso
  const handleAddAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    
    setIsAdding(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const emailLower = newEmail.trim().toLowerCase();
      
      // Comprobar si ya existe localmente
      if (accessList.some(a => a.email.toLowerCase() === emailLower)) {
        throw new Error("Este correo electrónico ya está autorizado para la demo.");
      }

      const { error } = await supabaseDemo
        .from('demo_access')
        .insert({
          email: emailLower,
          name: newName.trim() || null,
          company: newCompany.trim() || null
        });

      if (error) throw error;

      setSuccessMsg(`Acceso autorizado con éxito para ${emailLower}`);
      setNewEmail('');
      setNewName('');
      setNewCompany('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al registrar el acceso.");
    } finally {
      setIsAdding(false);
    }
  };

  // Eliminar acceso
  const handleRemoveAccess = async (id: string, email: string) => {
    if (!confirm(`¿Estás seguro de que quieres revocar el acceso de la demo para ${email}?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabaseDemo
        .from('demo_access')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSuccessMsg(`Acceso revocado para ${email}`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al revocar el acceso.");
    }
  };

  // KPIs
  const totalAuthorized = accessList.length;
  const uniqueVisitors = new Set(visitsList.map(v => v.email.toLowerCase())).size;
  const totalVisits = visitsList.length;
  const activeRate = totalAuthorized > 0 ? Math.round((uniqueVisitors / totalAuthorized) * 100) : 0;

  // Filtrado de accesos autorizados
  const filteredAccessList = accessList.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.email.toLowerCase().includes(term) ||
      (item.name || '').toLowerCase().includes(term) ||
      (item.company || '').toLowerCase().includes(term)
    );
  });

  const getDeviceIcon = (deviceType: string | null) => {
    const type = (deviceType || '').toLowerCase();
    if (type === 'desktop') return <Laptop size={14} />;
    if (type === 'mobile') return <Smartphone size={14} />;
    if (type === 'tablet') return <Tablet size={14} />;
    return <HelpCircle size={14} />;
  };

  return (
    <div className="demos-container">
      {/* Cabecera */}
      <div className="demos-header">
        <div>
          <h2>Gestión y Actividad de Demos</h2>
          <p className="text-muted">Autoriza accesos a la demo y monitoriza visitas y comportamiento de usuarios en tiempo real.</p>
        </div>
        <button onClick={fetchData} disabled={loading} className="btn btn-secondary btn-icon sync-btn">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success">
          <UserCheck size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid de KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#a5b4fc' }}>
            <UserCheck size={20} />
          </div>
          <div>
            <span className="kpi-label">Accesos Autorizados</span>
            <h3 className="kpi-value">{totalAuthorized}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
            <Eye size={20} />
          </div>
          <div>
            <span className="kpi-label">Usuarios Únicos Activos</span>
            <h3 className="kpi-value">{uniqueVisitors}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
            <Globe size={20} />
          </div>
          <div>
            <span className="kpi-label">Total Visitas registradas</span>
            <h3 className="kpi-value">{totalVisits}</h3>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <span className="kpi-label">Tasa de Activación</span>
            <h3 className="kpi-value">{activeRate}%</h3>
          </div>
        </div>
      </div>

      {/* Layout Principal de 2 Columnas */}
      <div className="demos-main-grid">
        {/* Columna Izquierda: Gestión de Accesos */}
        <div className="card-panel shadow-premium">
          <h4 className="panel-title">Autorizar Nuevo Acceso</h4>
          <form onSubmit={handleAddAccess} className="access-form">
            <div className="form-group">
              <label>Correo Electrónico *</label>
              <input 
                type="email" 
                placeholder="cliente@ejemplo.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="form-control"
              />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  placeholder="Ej. Juan Pérez"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label>Empresa</label>
                <input 
                  type="text" 
                  placeholder="Ej. Distribuidora Martínez"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>
            <button type="submit" disabled={isAdding || !newEmail} className="btn btn-primary btn-block">
              {isAdding ? 'Autorizando...' : 'Dar Acceso a la Demo'}
              <Plus size={16} style={{ marginLeft: 6 }} />
            </button>
          </form>

          <div className="panel-divider" />

          {/* Listado de Accesos */}
          <div className="list-header">
            <h4 className="panel-title" style={{ margin: 0 }}>Correos Autorizados</h4>
            <div className="search-box">
              <Search size={14} className="search-icon-inside" />
              <input 
                type="text" 
                placeholder="Buscar correo, nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          <div className="access-scroll-area">
            {filteredAccessList.length === 0 ? (
              <p className="no-data-text">No hay correos autorizados que coincidan.</p>
            ) : (
              <div className="access-table-wrap">
                <table className="access-table">
                  <thead>
                    <tr>
                      <th>Email / Datos</th>
                      <th>Fecha Autorización</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccessList.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div className="access-email-cell">
                            <span className="email-bold">{item.email}</span>
                            {(item.name || item.company) && (
                              <span className="email-subtitle">
                                {item.name || 'Sin nombre'} {item.company ? `(${item.company})` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="date-cell">
                          {new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td>
                          <button 
                            onClick={() => handleRemoveAccess(item.id, item.email)}
                            className="btn-delete-row"
                            title="Revocar acceso"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Seguimiento en Vivo */}
        <div className="tracking-column-grid">
          {/* Tarjeta: Visitas Recientes */}
          <div className="card-panel shadow-premium">
            <h4 className="panel-title flex-align">
              <Calendar size={16} style={{ marginRight: 8, color: '#34d399' }} />
              Visitas Recientes a la Demo
            </h4>
            <div className="live-scroll-area">
              {visitsList.length === 0 ? (
                <p className="no-data-text">Sin visitas registradas en la demo.</p>
              ) : (
                <div className="timeline-list">
                  {visitsList.map((visit) => (
                    <div key={visit.id} className="timeline-item">
                      <div className="timeline-badge" style={{ background: 'rgba(52, 211, 153, 0.12)', color: '#34d399' }}>
                        {getDeviceIcon(visit.device_type)}
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-header-row">
                          <strong className="timeline-email">{visit.email}</strong>
                          <span className="timeline-time">
                            {new Date(visit.visited_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="timeline-desc">
                          <span>Accedió a la demo desde dispositivo {visit.device_type || 'desconocido'}.</span>
                          <span className="timeline-ua-hint" title={visit.user_agent || ''}>
                            {visit.user_agent ? visit.user_agent.substring(0, 50) + '...' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta: Secciones exploradas */}
          <div className="card-panel shadow-premium">
            <h4 className="panel-title flex-align">
              <Sparkles size={16} style={{ marginRight: 8, color: '#a5b4fc' }} />
              Comportamiento y Secciones Vistas
            </h4>
            <div className="live-scroll-area">
              {eventsList.length === 0 ? (
                <p className="no-data-text">Sin acciones registradas.</p>
              ) : (
                <div className="timeline-list">
                  {eventsList.map((event) => {
                    const section = event.section.toLowerCase();
                    const badgeColor = 
                      section === 'manager' ? '#3b82f6' : 
                      section === 'kiosk' ? '#f59e0b' : 
                      section === 'employee' ? '#10b981' : '#6b7280';
                    const badgeText = 
                      section === 'manager' ? 'MÁNAGER' : 
                      section === 'kiosk' ? 'KIOSKO' : 
                      section === 'employee' ? 'EMPLEADO' : section.toUpperCase();
                    
                    return (
                      <div key={event.id} className="timeline-item">
                        <div className="timeline-badge" style={{ background: `${badgeColor}20`, color: badgeColor, fontSize: '0.65rem', fontWeight: 'bold', width: '22px', height: '22px' }}>
                          E
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-header-row">
                            <strong className="timeline-email">{event.email}</strong>
                            <span className="timeline-time">
                              {new Date(event.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="timeline-desc flex-align" style={{ gap: '8px' }}>
                            <span>Exploró la sección:</span>
                            <span 
                              style={{ 
                                display: 'inline-block', 
                                background: `${badgeColor}15`, 
                                color: badgeColor, 
                                border: `1px solid ${badgeColor}30`, 
                                fontSize: '0.65rem', 
                                fontWeight: 700, 
                                padding: '1px 6px', 
                                borderRadius: '4px',
                                letterSpacing: '0.04em'
                              }}
                            >
                              {badgeText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Estilos CSS Inline de la Página */}
      <style>{`
        .demos-container {
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .demos-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 20px;
        }
        .demos-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin: 0 0 6px 0;
        }
        
        /* Alertas */
        .alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.83rem;
          font-weight: 500;
        }
        .alert-error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--danger-light, #f87171);
        }
        .alert-success {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34d399;
        }

        /* KPIs */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .kpi-card {
          background: var(--surface-card, #111827);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: transform 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.08);
        }
        .kpi-icon-wrap {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .kpi-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 4px;
        }
        .kpi-value {
          font-size: 1.4rem;
          font-weight: 700;
          color: white;
          margin: 0;
        }

        /* Layout Principal */
        .demos-main-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 24px;
        }
        .card-panel {
          background: var(--surface-card, #111827);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
        }
        .shadow-premium {
          box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.7);
        }
        .panel-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: white;
          margin: 0 0 16px 0;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .flex-align {
          display: flex;
          align-items: center;
        }
        .panel-divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin: 24px 0;
        }

        /* Formulario de Accesos */
        .access-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .form-group label {
          font-size: 0.73rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .form-control {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
          font-size: 0.83rem;
          font-family: var(--font-sans);
          outline: none;
          transition: border-color 0.2s;
        }
        .form-control:focus {
          border-color: var(--primary-light);
        }

        /* Buscador e listado de accesos */
        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .search-box {
          position: relative;
          width: 200px;
        }
        .search-icon-inside {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-darker);
        }
        .search-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 6px 12px 6px 30px;
          color: white;
          font-size: 0.78rem;
          outline: none;
          transition: all 0.2s;
        }
        .search-input:focus {
          border-color: var(--primary-light);
          width: 240px;
        }
        .access-scroll-area {
          overflow-y: auto;
          max-height: 280px;
          min-height: 120px;
        }
        .no-data-text {
          font-size: 0.8rem;
          color: var(--text-darker);
          font-style: italic;
          text-align: center;
          margin: 40px 0;
        }

        /* Tabla de accesos */
        .access-table-wrap {
          border: 1px solid rgba(255,255,255,0.03);
          border-radius: 10px;
          overflow: hidden;
        }
        .access-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.78rem;
        }
        .access-table th {
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding: 10px 14px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .access-table td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
          padding: 10px 14px;
          vertical-align: middle;
        }
        .access-table tr:hover td {
          background: rgba(255, 255, 255, 0.01);
        }
        .access-email-cell {
          display: flex;
          flex-direction: column;
        }
        .email-bold {
          font-weight: 600;
          color: white;
        }
        .email-subtitle {
          font-size: 0.68rem;
          color: var(--text-darker);
          margin-top: 2px;
        }
        .date-cell {
          color: var(--text-muted);
        }
        .btn-delete-row {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .btn-delete-row:hover {
          color: var(--danger-light, #f87171);
          background: rgba(239, 68, 68, 0.08);
        }

        /* Columna derecha: Timelines */
        .tracking-column-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .live-scroll-area {
          overflow-y: auto;
          max-height: 250px;
          min-height: 100px;
          padding-right: 4px;
        }
        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .timeline-item {
          display: flex;
          gap: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.02);
          padding: 10px 14px;
          border-radius: 10px;
        }
        .timeline-item:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255,255,255,0.04);
        }
        .timeline-badge {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .timeline-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .timeline-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .timeline-email {
          font-size: 0.78rem;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 70%;
        }
        .timeline-time {
          font-size: 0.68rem;
          color: var(--text-darker);
          font-weight: 500;
        }
        .timeline-desc {
          font-size: 0.72rem;
          color: var(--text-muted);
          line-height: 1.3;
        }
        .timeline-ua-hint {
          display: block;
          font-size: 0.62rem;
          color: var(--text-darker);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: help;
        }

        /* Botones y clases globales */
        .btn-block {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sync-btn {
          gap: 8px;
        }
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
