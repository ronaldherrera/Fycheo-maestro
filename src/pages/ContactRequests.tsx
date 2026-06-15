import React, { useState, useEffect, useCallback } from 'react';
import { 
  MessageSquare, 
  Trash2, 
  Star, 
  AlertCircle, 
  CheckCircle2, 
  Mail, 
  Phone, 
  Copy, 
  Check, 
  RefreshCw, 
  Search, 
  Inbox, 
  Clock, 
  Building2,
  ArchiveRestore,
  CornerUpLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
  read: boolean;
  starred: boolean;
  important: boolean;
  replied: boolean;
  reply_body: string | null;
  replied_at: string | null;
  trashed_at: string | null;
}

interface ContactRequestsProps {
  setIsComposeOpen: (open: boolean) => void;
  setComposePreset: (preset: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    contactId?: string;
  } | null) => void;
}

export const ContactRequests: React.FC<ContactRequestsProps> = ({
  setIsComposeOpen,
  setComposePreset,
}) => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'starred' | 'replied' | 'trash'>('all');
  
  // Mensajes de éxito y error
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Obtener mensajes desde Supabase
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (err: any) {
      console.error('[ContactRequests] Error fetching messages:', err);
      setErrorMsg(err.message || 'Error al conectar con la base de datos de contactos.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Suscripción Realtime y carga inicial
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel('contact_messages_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_messages' },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  // Obtener el mensaje seleccionado
  const selectedMessage = messages.find((m) => m.id === selectedId);

  // Marcar como leído al seleccionar un mensaje sin leer
  useEffect(() => {
    if (selectedMessage && !selectedMessage.read) {
      handleToggleRead(selectedMessage.id, true);
    }
  }, [selectedId, selectedMessage]);

  // Acciones en base de datos
  const handleToggleRead = async (id: string, read: boolean) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ read })
        .eq('id', id);

      if (error) throw error;
      
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, read } : m))
      );
    } catch (err: any) {
      console.error('[ContactRequests] Error updating read state:', err);
    }
  };

  const handleToggleStarred = async (id: string, starred: boolean) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ starred })
        .eq('id', id);

      if (error) throw error;
      
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, starred } : m))
      );
    } catch (err: any) {
      console.error('[ContactRequests] Error updating starred state:', err);
    }
  };

  const handleToggleImportant = async (id: string, important: boolean) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ important })
        .eq('id', id);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, important } : m))
      );
    } catch (err: any) {
      console.error('[ContactRequests] Error updating important state:', err);
    }
  };

  const handleTrashMessage = async (id: string, trash: boolean) => {
    try {
      const trashed_at = trash ? new Date().toISOString() : null;
      const { error } = await supabase
        .from('contact_messages')
        .update({ trashed_at })
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg(trash ? 'Mensaje movido a la papelera.' : 'Mensaje restaurado con éxito.');
      
      if (trash && selectedId === id) {
        setSelectedId(null);
      }
      
      fetchMessages();
    } catch (err: any) {
      console.error('[ContactRequests] Error trashing message:', err);
      setErrorMsg(err.message || 'Error al cambiar el estado del mensaje.');
    }
  };

  const handleDeletePermanent = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar permanentemente este mensaje de contacto? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMsg('Mensaje eliminado permanentemente de la base de datos.');
      if (selectedId === id) {
        setSelectedId(null);
      }
      fetchMessages();
    } catch (err: any) {
      console.error('[ContactRequests] Error deleting message permanently:', err);
      setErrorMsg(err.message || 'Error al eliminar el mensaje.');
    }
  };

  // Copiar correo al portapapeles
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(email);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Inicializar composición de correo y abrir Composer
  const handleOpenComposer = () => {
    if (!selectedMessage) return;

    const originalText = selectedMessage.message || '';
    const cleanOriginal = originalText.replace(/\n/g, '<br/>');
    
    // Preset del cuerpo del email con firma y cita del mensaje original
    const bodyPreset = `<br/><br/><br/><hr style="border:none;border-top:1px solid rgba(0,0,0,0.06);margin:20px 0;"/>
<div style="font-size:0.88rem;color:#666;border-left:3px solid #8b5cf6;padding-left:14px;margin-left:4px;font-family:sans-serif;">
  <p style="margin:0 0 6px 0;color:#333;"><strong>Mensaje original recibido de ${selectedMessage.name} (${selectedMessage.email}):</strong></p>
  <p style="margin:0;font-style:italic;">"${cleanOriginal}"</p>
</div>`;

    setComposePreset({
      to: selectedMessage.email,
      subject: `Re: Mensaje de contacto - Fycheo`,
      body: bodyPreset,
      from: 'soporte@fycheo.es', // soporte por defecto
      contactId: selectedMessage.id
    });

    setIsComposeOpen(true);
  };

  // KPIs
  const kpiTotal = messages.filter((m) => !m.trashed_at).length;
  const kpiUnread = messages.filter((m) => !m.read && !m.trashed_at).length;
  const kpiStarred = messages.filter((m) => m.starred && !m.trashed_at).length;
  const kpiReplied = messages.filter((m) => m.replied && !m.trashed_at).length;

  // Filtrado y Búsqueda
  const filteredMessages = messages.filter((m) => {
    if (activeFilter === 'trash') {
      if (!m.trashed_at) return false;
    } else {
      if (m.trashed_at) return false;
      if (activeFilter === 'unread' && m.read) return false;
      if (activeFilter === 'starred' && !m.starred) return false;
      if (activeFilter === 'replied' && !m.replied) return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      (m.company || '').toLowerCase().includes(term) ||
      (m.phone || '').toLowerCase().includes(term) ||
      (m.message || '').toLowerCase().includes(term)
    );
  });

  const formatMsgDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Ayer';
    }
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="contacts-container">
      {/* Cabecera */}
      <div className="contacts-header">
        <div>
          <h2>Mensajes de Contacto (Web)</h2>
          <p className="text-muted">Gestiona consultas de prospectos, dudas generales y solicitudes del formulario web.</p>
        </div>
        <button onClick={fetchMessages} disabled={loading} className="btn btn-secondary btn-icon sync-btn">
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          <span>{loading ? 'Sincronizando...' : 'Actualizar'}</span>
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
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPIs Grid */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => setActiveFilter('all')}>
          <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa' }}>
            <Inbox size={20} />
          </div>
          <div>
            <span className="kpi-label">Total Recibidos</span>
            <h3 className="kpi-value">{kpiTotal}</h3>
          </div>
        </div>
        <div className="kpi-card" onClick={() => setActiveFilter('unread')}>
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171' }}>
            <Clock size={20} />
          </div>
          <div>
            <span className="kpi-label">Pendientes (Sin Leer)</span>
            <h3 className="kpi-value" style={{ color: kpiUnread > 0 ? '#f87171' : 'white' }}>{kpiUnread}</h3>
          </div>
        </div>
        <div className="kpi-card" onClick={() => setActiveFilter('replied')}>
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="kpi-label">Respondidos</span>
            <h3 className="kpi-value">{kpiReplied}</h3>
          </div>
        </div>
        <div className="kpi-card" onClick={() => setActiveFilter('starred')}>
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
            <Star size={20} />
          </div>
          <div>
            <span className="kpi-label">Destacados</span>
            <h3 className="kpi-value">{kpiStarred}</h3>
          </div>
        </div>
      </div>

      {/* Layout de 2 columnas */}
      <div className="contacts-main-grid">
        {/* Columna Izquierda: Buscador, Carpetas y Lista */}
        <div className="card-panel shadow-premium left-panel">
          <div className="filter-tabs">
            <button 
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              Recibidos
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setActiveFilter('unread')}
            >
              Sin Leer {kpiUnread > 0 && <span className="tab-count count-danger">{kpiUnread}</span>}
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'starred' ? 'active' : ''}`}
              onClick={() => setActiveFilter('starred')}
            >
              Destacados
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'replied' ? 'active' : ''}`}
              onClick={() => setActiveFilter('replied')}
            >
              Contestados
            </button>
            <button 
              className={`filter-btn ${activeFilter === 'trash' ? 'active' : ''}`}
              onClick={() => setActiveFilter('trash')}
            >
              Papelera
            </button>
          </div>

          <div className="search-bar-wrap">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Buscar por nombre, email, mensaje..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input-field"
            />
          </div>

          <div className="messages-scroll-area">
            {loading && messages.length === 0 ? (
              <div className="loading-state">
                <RefreshCw size={24} className="spinning" />
                <p>Cargando mensajes...</p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="empty-state">
                <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>No se encontraron mensajes en esta sección.</p>
              </div>
            ) : (
              <div className="messages-list">
                {filteredMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    onClick={() => setSelectedId(msg.id)}
                    className={`message-item ${selectedId === msg.id ? 'selected' : ''} ${!msg.read ? 'unread-item' : ''}`}
                  >
                    <div className="item-header">
                      <div className="item-sender-info">
                        <strong className="item-name">{msg.name}</strong>
                        {msg.company && (
                          <span className="item-company">
                            <Building2 size={11} style={{ marginRight: 3 }} />
                            {msg.company}
                          </span>
                        )}
                      </div>
                      <span className="item-date">{formatMsgDate(msg.created_at)}</span>
                    </div>
                    
                    <div className="item-email-line">{msg.email}</div>
                    
                    <p className="item-snippet">
                      {msg.message ? msg.message.substring(0, 80) + (msg.message.length > 80 ? '...' : '') : 'Sin mensaje.'}
                    </p>

                    <div className="item-badges">
                      {!msg.read && <span className="dot-unread" title="Sin leer" />}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStarred(msg.id, !msg.starred);
                        }} 
                        className={`btn-star-icon ${msg.starred ? 'active-star' : ''}`}
                        title={msg.starred ? "Quitar destacado" : "Destacar"}
                      >
                        <Star size={13} fill={msg.starred ? "#fbbf24" : "none"} />
                      </button>

                      {msg.important && (
                        <span className="badge-important-pill" title="Mensaje Importante">
                          Importante
                        </span>
                      )}

                      {msg.replied && (
                        <span className="badge-replied-pill">
                          <Check size={11} style={{ marginRight: 3 }} />
                          Respondido
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Detalle */}
        <div className="card-panel shadow-premium right-panel detail-panel">
          {!selectedMessage ? (
            <div className="no-message-selected">
              <div className="glow-icon-wrap">
                <MessageSquare size={40} className="glow-icon" />
              </div>
              <h4>Detalle de Solicitud</h4>
              <p>Selecciona cualquier mensaje de la bandeja de entrada para leer su contenido, gestionarlo y enviar una respuesta directa por correo.</p>
            </div>
          ) : (
            <div className="message-detail-wrap">
              {/* Acciones */}
              <div className="detail-actions-header">
                <div className="actions-left">
                  <button 
                    onClick={() => handleToggleStarred(selectedMessage.id, !selectedMessage.starred)}
                    className={`action-btn-header ${selectedMessage.starred ? 'active-star-h' : ''}`}
                    title={selectedMessage.starred ? "Quitar destacado" : "Destacar"}
                  >
                    <Star size={16} fill={selectedMessage.starred ? "#fbbf24" : "none"} />
                    <span>{selectedMessage.starred ? 'Destacado' : 'Destacar'}</span>
                  </button>

                  <button 
                    onClick={() => handleToggleImportant(selectedMessage.id, !selectedMessage.important)}
                    className={`action-btn-header ${selectedMessage.important ? 'active-important-h' : ''}`}
                    title={selectedMessage.important ? "Quitar importancia" : "Marcar como importante"}
                  >
                    <AlertCircle size={16} />
                    <span>{selectedMessage.important ? 'Importante' : 'Marcar Importante'}</span>
                  </button>

                  <button 
                    onClick={() => handleToggleRead(selectedMessage.id, !selectedMessage.read)}
                    className="action-btn-header"
                    title={selectedMessage.read ? "Marcar como no leído" : "Marcar como leído"}
                  >
                    <Mail size={16} />
                    <span>{selectedMessage.read ? 'No Leído' : 'Leído'}</span>
                  </button>
                </div>

                <div className="actions-right">
                  {selectedMessage.trashed_at ? (
                    <>
                      <button 
                        onClick={() => handleTrashMessage(selectedMessage.id, false)}
                        className="action-btn-header success-hover"
                        title="Restaurar a Recibidos"
                      >
                        <ArchiveRestore size={16} />
                        <span>Restaurar</span>
                      </button>
                      <button 
                        onClick={() => handleDeletePermanent(selectedMessage.id)}
                        className="action-btn-header danger-hover"
                        title="Eliminar permanentemente de la BD"
                      >
                        <Trash2 size={16} />
                        <span>Eliminar BD</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleTrashMessage(selectedMessage.id, true)}
                      className="action-btn-header danger-hover"
                      title="Mover a la Papelera"
                    >
                      <Trash2 size={16} />
                      <span>Papelera</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Título */}
              <div className="detail-sender-card">
                <div className="sender-avatar">
                  {selectedMessage.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                </div>
                <div className="sender-metadata">
                  <h3>{selectedMessage.name}</h3>
                  <span className="msg-full-date">
                    Recibido el {new Date(selectedMessage.created_at).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Fila de Datos */}
              <div className="detail-contact-tags">
                <div className="tag-info">
                  <Mail size={12} className="tag-icon" />
                  <span className="tag-text">{selectedMessage.email}</span>
                  <button 
                    onClick={() => handleCopyEmail(selectedMessage.email)}
                    className="btn-copy-tag"
                    title="Copiar email"
                  >
                    {copiedId === selectedMessage.email ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                  </button>
                </div>

                {selectedMessage.phone && (
                  <a href={`tel:${selectedMessage.phone}`} className="tag-info clickable-tag">
                    <Phone size={12} className="tag-icon" />
                    <span className="tag-text">{selectedMessage.phone}</span>
                  </a>
                )}

                {selectedMessage.company && (
                  <div className="tag-info">
                    <Building2 size={12} className="tag-icon" />
                    <span className="tag-text">{selectedMessage.company}</span>
                  </div>
                )}
              </div>

              {/* Cuerpo del mensaje original */}
              <div className="detail-message-body-wrap">
                <h5 className="section-small-title">Mensaje enviado:</h5>
                <div className="message-content-text">
                  {(selectedMessage.message || '').split('\n').map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))}
                </div>
              </div>

              {/* Historial de Respuestas */}
              {selectedMessage.replied && (
                <div className="detail-history-reply">
                  <div className="reply-history-header">
                    <CheckCircle2 size={14} className="history-icon" />
                    <span>Respuesta enviada el {selectedMessage.replied_at ? new Date(selectedMessage.replied_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                  <div className="reply-history-body">
                    {(selectedMessage.reply_body || '').split('\n').map((line, idx) => (
                      <p key={idx} style={{ margin: '0 0 6px 0' }}>{line}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Redirección al Redactor Global */}
              {!selectedMessage.trashed_at && (
                <div className="detail-reply-editor-wrap">
                  <button 
                    onClick={handleOpenComposer} 
                    className="btn btn-primary reply-trigger-btn"
                  >
                    <CornerUpLeft size={15} style={{ marginRight: 6 }} />
                    {selectedMessage.replied ? 'Enviar otra respuesta (Redactor)' : 'Responder Solicitud (Redactor)'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Estilos CSS Inline Premium */}
      <style>{`
        .contacts-container {
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .contacts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 20px;
        }
        .contacts-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: white;
          margin: 0 0 6px 0;
        }
        
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
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.5);
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

        .contacts-main-grid {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 24px;
          align-items: start;
        }
        .card-panel {
          background: var(--surface-card, #111827);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: 600px;
        }
        .shadow-premium {
          box-shadow: 0 10px 30px -15px rgba(0, 0, 0, 0.7);
        }

        .filter-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 12px;
        }
        .filter-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.03);
        }
        .filter-btn.active {
          background: rgba(139, 92, 246, 0.12);
          color: var(--primary-light, #a5b4fc);
          border-color: rgba(139, 92, 246, 0.25);
        }
        .tab-count {
          font-size: 0.65rem;
          padding: 1px 5px;
          border-radius: 10px;
          font-weight: 700;
        }
        .count-danger {
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .search-bar-wrap {
          position: relative;
          margin-bottom: 16px;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-darker);
        }
        .search-input-field {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 8px 12px 8px 36px;
          color: white;
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .search-input-field:focus {
          border-color: var(--primary-light);
        }

        .messages-scroll-area {
          overflow-y: auto;
          flex: 1;
          padding-right: 4px;
        }
        .loading-state, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          color: var(--text-darker);
          font-size: 0.8rem;
          text-align: center;
        }
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .message-item {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 12px 14px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .message-item:hover {
          background: rgba(255, 255, 255, 0.02);
          border-color: rgba(255, 255, 255, 0.05);
        }
        .message-item.selected {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.02) 100%);
          border-color: rgba(139, 92, 246, 0.25);
        }
        .unread-item {
          border-left: 3px solid var(--primary-light);
          padding-left: 11px;
        }

        .item-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .item-sender-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .item-name {
          font-size: 0.85rem;
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .item-company {
          font-size: 0.68rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          margin-top: 1px;
        }
        .item-date {
          font-size: 0.68rem;
          color: var(--text-darker);
          font-weight: 500;
          white-space: nowrap;
        }
        .item-email-line {
          font-size: 0.72rem;
          color: var(--text-darker);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .item-snippet {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin: 2px 0 0;
          line-height: 1.3;
        }

        .item-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .dot-unread {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary-light, #a5b4fc);
          box-shadow: 0 0 8px var(--primary-light);
        }
        .btn-star-icon {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        .btn-star-icon:hover {
          color: #fbbf24;
        }
        .btn-star-icon.active-star {
          color: #fbbf24;
        }
        .badge-important-pill {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .badge-replied-pill {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 4px;
          display: flex;
          align-items: center;
        }

        .detail-panel {
          height: 600px;
          overflow-y: auto;
        }
        .no-message-selected {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          text-align: center;
          max-width: 380px;
          margin: 0 auto;
        }
        .glow-icon-wrap {
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .glow-icon {
          color: var(--primary-light);
          filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.4));
        }
        .no-message-selected h4 {
          font-size: 0.95rem;
          color: white;
          margin: 0 0 8px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .no-message-selected p {
          font-size: 0.78rem;
          line-height: 1.5;
          margin: 0;
          color: var(--text-darker);
        }

        .message-detail-wrap {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .detail-actions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding-bottom: 14px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .actions-left, .actions-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .action-btn-header {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 0.72rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .action-btn-header:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255,255,255,0.08);
        }
        .active-star-h {
          color: #fbbf24 !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
          background: rgba(251, 191, 36, 0.05) !important;
        }
        .active-important-h {
          color: #f87171 !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          background: rgba(239, 68, 68, 0.05) !important;
        }
        .danger-hover:hover {
          color: #f87171 !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          background: rgba(239, 68, 68, 0.05) !important;
        }
        .success-hover:hover {
          color: #34d399 !important;
          border-color: rgba(16, 185, 129, 0.3) !important;
          background: rgba(16, 185, 129, 0.05) !important;
        }

        .detail-sender-card {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .sender-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: var(--primary-light);
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .sender-metadata h3 {
          font-size: 1.05rem;
          color: white;
          margin: 0 0 3px 0;
          font-weight: 600;
        }
        .msg-full-date {
          font-size: 0.72rem;
          color: var(--text-darker);
          font-weight: 500;
        }

        .detail-contact-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tag-info {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          padding: 5px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .clickable-tag {
          text-decoration: none;
          transition: all 0.2s;
        }
        .clickable-tag:hover {
          background: rgba(255, 255, 255, 0.04);
          color: white;
          border-color: rgba(255, 255, 255, 0.08);
        }
        .tag-icon {
          color: var(--text-darker);
        }
        .tag-text {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .btn-copy-tag {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 2px;
          transition: color 0.2s;
        }
        .btn-copy-tag:hover {
          color: white;
        }

        .detail-message-body-wrap {
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.02);
          border-radius: 12px;
          padding: 16px;
        }
        .section-small-title {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-darker);
          margin: 0 0 10px 0;
          font-weight: 700;
        }
        .message-content-text {
          font-size: 0.83rem;
          color: rgba(255,255,255,0.9);
          line-height: 1.6;
          margin: 0;
        }
        .message-content-text p {
          margin: 0 0 10px 0;
        }
        .message-content-text p:last-child {
          margin: 0;
        }

        .detail-history-reply {
          background: rgba(139, 92, 246, 0.03);
          border: 1px solid rgba(139, 92, 246, 0.15);
          border-left: 3px solid var(--primary-light);
          border-radius: 10px;
          padding: 14px 16px;
        }
        .reply-history-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--primary-light);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .history-icon {
          color: var(--primary-light);
        }
        .reply-history-body {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.85);
          line-height: 1.5;
        }

        .detail-reply-editor-wrap {
          margin-top: 10px;
        }
        .reply-trigger-btn {
          width: 100%;
          padding: 10px;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .btn {
          font-family: var(--font-sans);
          font-weight: 600;
          border-radius: 10px;
          padding: 8px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .btn-primary {
          background: #8b5cf6;
          color: white;
        }
        .btn-primary:hover {
          background: #7c3aed;
          box-shadow: 0 0 10px rgba(139,92,246,0.3);
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--border-color);
          color: var(--text-main);
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255,255,255,0.08);
        }
        .btn-icon {
          gap: 6px;
        }
        .sync-btn {
          font-size: 0.78rem;
          padding: 6px 12px;
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
