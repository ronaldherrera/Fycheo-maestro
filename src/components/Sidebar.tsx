import React from 'react';
import {
  Users,
  Mail,
  Activity,
  TrendingUp,
  LogOut,
  Crown,
  Inbox,
  Megaphone,
  FileText,
  Send,
  Trash2,
  Sparkles,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Settings2,
  CheckCheck,
  LifeBuoy,
  CreditCard,
  BookOpen,
} from 'lucide-react';
import { MAILBOXES } from '../lib/mailboxes';
import { MailboxSettings } from '../lib/emailService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  emailsFolder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking';
  setEmailsFolder: (folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking') => void;
  isComposeOpen: boolean;
  unreadInboxCount: number;
  unreadDraftsCount: number;
  marketingSection: string;
  setMarketingSection: (s: string) => void;
  cuadernoSection: string;
  setCuadernoSection: (s: 'notas' | 'agenda' | 'enlaces') => void;
  onSignOut: () => void;
  staffName: string;
  staffRole: string;
  staffAvatar: string;
  activeMailbox: string;
  setActiveMailbox: (m: string) => void;
  unreadPerMailbox: Record<string, number>;
  mailboxCustomizations: Record<string, { displayName: string; avatar: string; color: string }>;
  mailboxSettingsMap: Record<string, MailboxSettings>;
  unreadContactsCount: number;
  allowedScreens: string[];
  allowedMailboxes: string[];
  setIsComposeOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  emailsFolder,
  setEmailsFolder,
  unreadDraftsCount,
  onSignOut,
  staffName,
  staffRole,
  staffAvatar,
  activeMailbox,
  setActiveMailbox,
  unreadPerMailbox,
  mailboxCustomizations,
  mailboxSettingsMap,
  unreadContactsCount,
  allowedScreens,
  allowedMailboxes,
  marketingSection,
  setMarketingSection,
  cuadernoSection,
  setCuadernoSection,
}) => {
  const isInboxEnabled = (email: string, staticInbox: boolean) =>
    mailboxSettingsMap[email] ? mailboxSettingsMap[email].inbox_enabled : staticInbox;
  const [isEmailsExpanded, setIsEmailsExpanded] = React.useState(activeTab === 'emails');
  const [isMarketingExpanded, setIsMarketingExpanded] = React.useState(activeTab === 'marketing');
  const [isCuadernoExpanded, setIsCuadernoExpanded] = React.useState(activeTab === 'cuaderno');
  const [expandedMailboxes, setExpandedMailboxes] = React.useState<string[]>(['all']);

  React.useEffect(() => {
    if (activeTab === 'emails') setIsEmailsExpanded(true);
    if (activeTab === 'marketing') setIsMarketingExpanded(true);
    if (activeTab === 'cuaderno') setIsCuadernoExpanded(true);
  }, [activeTab]);

  const menuItems = [
    { id: 'dashboard',  label: 'Dashboard',      icon: TrendingUp    },
    { id: 'support',    label: 'Soporte',         icon: LifeBuoy      },
    { id: 'finanzas',   label: 'Finanzas',        icon: CreditCard    },
    { id: 'marketing',  label: 'Marketing',       icon: Megaphone     },
    { id: 'emails',     label: 'Correos',         icon: Mail          },
    { id: 'demos',      label: 'Demo',            icon: Sparkles      },
    { id: 'contacts',   label: 'Solicitudes',     icon: MessageSquare },
    { id: 'staff',      label: 'Equipo Fycheo',   icon: Crown         },
    { id: 'cuaderno',  label: 'Cuaderno',        icon: BookOpen      },
  ];

  const goEmail = (mailbox: string, folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking') => {
    setActiveTab('emails');
    setActiveMailbox(mailbox);
    setEmailsFolder(folder);
  };

  const toggleMailbox = (email: string) => {
    setExpandedMailboxes(prev =>
      prev.includes(email) ? [] : [email]
    );
  };

  const isActive = (mailbox: string, folder: string) =>
    activeTab === 'emails' && activeMailbox === mailbox && emailsFolder === folder;

  const isScreenAllowed = (id: string) =>
    allowedScreens.length === 0 || allowedScreens.includes(id);

  const isMailboxAllowed = (email: string) =>
    allowedMailboxes.length === 0 || allowedMailboxes.includes(email);

  const filteredMenuItems = menuItems.filter(item => isScreenAllowed(item.id));

  const totalUnread = Object.entries(unreadPerMailbox)
    .filter(([email]) => isMailboxAllowed(email))
    .reduce((a, [, b]) => a + b, 0);

  return (
    <aside className="sidebar-container">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <img src="https://fycheo.es/brand/icono.svg" alt="Fycheo Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="logo-text">
          <h2>Fycheo</h2>
          <span>Maestro v1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isEmails    = item.id === 'emails';
          const isMarketing = item.id === 'marketing';
          const isCuaderno  = item.id === 'cuaderno';
          const unreadMkt   = unreadPerMailbox['marketing@fycheo.es'] ?? 0;
          return (
            <div key={item.id} className="nav-item-wrapper">
              <button
                onClick={() => {
                    if (isEmails) {
                      setActiveTab('emails');
                      setIsEmailsExpanded(prev => activeTab === 'emails' ? !prev : true);
                    } else if (isMarketing) {
                      setActiveTab('marketing');
                      setIsMarketingExpanded(prev => activeTab === 'marketing' ? !prev : true);
                    } else if (isCuaderno) {
                      setActiveTab('cuaderno');
                      setIsCuadernoExpanded(prev => activeTab === 'cuaderno' ? !prev : true);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              >
                <div className="nav-item-content">
                  <Icon size={18} />
                  <span>{item.label}</span>
                </div>
                {isEmails && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    {totalUnread > 0 && (
                      <span className="submenu-count" style={{ background: 'var(--primary, #8b5cf6)', color: 'white', padding: '1px 6px', borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700, margin: 0 }}>
                        {totalUnread}
                      </span>
                    )}
                    <div className="chevron-icon" style={{ display: 'flex', alignItems: 'center' }}>
                      {isEmailsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                )}
                {isMarketing && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                    {unreadMkt > 0 && (
                      <span className="submenu-count" style={{ background: 'var(--primary, #8b5cf6)', color: 'white', padding: '1px 6px', borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700, margin: 0 }}>
                        {unreadMkt}
                      </span>
                    )}
                    <div className="chevron-icon" style={{ display: 'flex', alignItems: 'center' }}>
                      {isMarketingExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                )}
                {isCuaderno && (
                  <div className="chevron-icon" style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                    {isCuadernoExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                )}
                {item.id === 'contacts' && unreadContactsCount > 0 && (
                  <span className="submenu-count" style={{ marginLeft: 'auto', background: 'var(--primary, #8b5cf6)', color: 'white', padding: '1px 6px', borderRadius: '100px', fontSize: '0.68rem', fontWeight: 700 }}>
                    {unreadContactsCount}
                  </span>
                )}
              </button>

              {isCuaderno && isCuadernoExpanded && (
                <div className="submenu-container">
                  {([
                    { id: 'notas',   label: 'Notas y tareas', Icon: FileText  },
                    { id: 'agenda',  label: 'Agenda',          Icon: Users     },
                    { id: 'enlaces', label: 'Enlaces',          Icon: Activity  },
                  ] as const).map(({ id, label, Icon: SubIcon }) => (
                    <button
                      key={id}
                      className={`submenu-item ${activeTab === 'cuaderno' && cuadernoSection === id ? 'active' : ''}`}
                      onClick={() => { setActiveTab('cuaderno'); setCuadernoSection(id); }}
                    >
                      <SubIcon size={12} /><span>{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {isMarketing && isMarketingExpanded && (
                <div className="submenu-container">
                  <button className={`submenu-item ${activeTab === 'marketing' && marketingSection === 'campañas' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('marketing'); setMarketingSection('campañas'); }}>
                    <TrendingUp size={12} /><span>Campañas</span>
                  </button>
                  <button className={`submenu-item ${activeTab === 'marketing' && marketingSection === 'blog' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('marketing'); setMarketingSection('blog'); }}>
                    <FileText size={12} /><span>Blog</span>
                  </button>
                  <button className={`submenu-item ${activeTab === 'marketing' && marketingSection === 'analisis' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('marketing'); setMarketingSection('analisis'); }}>
                    <Activity size={12} /><span>Análisis web</span>
                  </button>
                </div>
              )}

              {isEmails && isEmailsExpanded && (
                <div className="submenu-container">



                  {/* ── BUZONES ── */}
                  <span className="submenu-header-title" style={{ marginTop: 8 }}>Buzones</span>

                  {/* TODAS */}
                  <div className="mailbox-tree-item">
                    <button
                      className={`mailbox-tree-header ${activeMailbox === 'all' && emailsFolder === 'inbox' ? 'active' : ''}`}
                      onClick={() => toggleMailbox('all')}
                    >
                      <span className="mailbox-dot" style={{ background: '#6366f1' }} />
                      <span className="mailbox-tree-label">Todas</span>
                      {totalUnread > 0 && <span className="submenu-count">{totalUnread}</span>}
                      <span className="mailbox-tree-chevron">
                        {expandedMailboxes.includes('all') ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </span>
                    </button>
                    {expandedMailboxes.includes('all') && (
                      <div className="mailbox-tree-sub">
                        <button className={`submenu-item ${isActive('all', 'inbox') ? 'active' : ''}`}
                          onClick={() => goEmail('all', 'inbox')}>
                          <Inbox size={12} /><span>Recibidos</span>
                          {totalUnread > 0 && <span className="submenu-count">{totalUnread}</span>}
                        </button>
                        <button className={`submenu-item ${isActive('all', 'sent') ? 'active' : ''}`}
                          onClick={() => goEmail('all', 'sent')}>
                          <Send size={12} /><span>Enviados</span>
                        </button>
                        <button className={`submenu-item ${isActive('all', 'tracking') ? 'active' : ''}`}
                          onClick={() => goEmail('all', 'tracking')}>
                          <CheckCheck size={12} /><span>Seguimiento</span>
                        </button>
                        <button className={`submenu-item ${isActive('all', 'trash') ? 'active' : ''}`}
                          onClick={() => goEmail('all', 'trash')}>
                          <Trash2 size={12} /><span>Papelera</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Buzones con Entrada (Recibidos) */}
                  {MAILBOXES.filter(m => isInboxEnabled(m.email, m.inbox) && m.email !== 'marketing@fycheo.es' && isMailboxAllowed(m.email)).map(m => {
                    const unread = unreadPerMailbox[m.email] ?? 0;
                    const expanded = expandedMailboxes.includes(m.email);
                    const isMailboxActive = activeMailbox === m.email;
                    const displayName = mailboxCustomizations[m.email]?.displayName || m.label;
                    return (
                      <div key={m.email} className="mailbox-tree-item">
                        <button
                          className={`mailbox-tree-header ${isMailboxActive ? 'active' : ''}`}
                          onClick={() => toggleMailbox(m.email)}
                        >
                          <span className="mailbox-dot" style={{ background: mailboxCustomizations[m.email]?.color || m.color }} />
                          <span className="mailbox-tree-label">{displayName}</span>
                          {unread > 0 && <span className="submenu-count">{unread}</span>}
                          <span className="mailbox-tree-chevron">
                            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                        </button>
                        {expanded && (
                          <div className="mailbox-tree-sub">
                            {isInboxEnabled(m.email, m.inbox) && (
                              <button className={`submenu-item ${isActive(m.email, 'inbox') ? 'active' : ''}`}
                                onClick={() => goEmail(m.email, 'inbox')}>
                                <Inbox size={12} /><span>Recibidos</span>
                                {unread > 0 && <span className="submenu-count">{unread}</span>}
                              </button>
                            )}
                            <button className={`submenu-item ${isActive(m.email, 'sent') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'sent')}>
                              <Send size={12} /><span>Enviados</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'drafts') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'drafts')}>
                              <FileText size={12} /><span>Borradores</span>
                              {unreadDraftsCount > 0 && isMailboxActive && <span className="submenu-count">{unreadDraftsCount}</span>}
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'trash') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'trash')}>
                              <Trash2 size={12} /><span>Papelera</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'settings') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'settings')}>
                              <Settings2 size={12} /><span>Configuración</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'tracking') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'tracking')}>
                              <CheckCheck size={12} /><span>Seguimiento</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="submenu-divider" style={{ margin: '10px 8px', opacity: 0.6 }} />

                  {/* Buzones sin bandeja de entrada */}
                  {MAILBOXES.filter(m => !isInboxEnabled(m.email, m.inbox) && m.email !== 'marketing@fycheo.es' && isMailboxAllowed(m.email)).map(m => {
                    const unread = unreadPerMailbox[m.email] ?? 0;
                    const expanded = expandedMailboxes.includes(m.email);
                    const isMailboxActive = activeMailbox === m.email;
                    const displayName = mailboxCustomizations[m.email]?.displayName || m.label;
                    return (
                      <div key={m.email} className="mailbox-tree-item">
                        <button
                          className={`mailbox-tree-header ${isMailboxActive ? 'active' : ''}`}
                          onClick={() => toggleMailbox(m.email)}
                        >
                          <span className="mailbox-dot" style={{ background: mailboxCustomizations[m.email]?.color || m.color }} />
                          <span className="mailbox-tree-label">{displayName}</span>
                          {unread > 0 && <span className="submenu-count">{unread}</span>}
                          <span className="mailbox-tree-chevron">
                            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                        </button>
                        {expanded && (
                          <div className="mailbox-tree-sub">
                            {m.inbox && (
                              <button className={`submenu-item ${isActive(m.email, 'inbox') ? 'active' : ''}`}
                                onClick={() => goEmail(m.email, 'inbox')}>
                                <Inbox size={12} /><span>Recibidos</span>
                                {unread > 0 && <span className="submenu-count">{unread}</span>}
                              </button>
                            )}
                            <button className={`submenu-item ${isActive(m.email, 'sent') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'sent')}>
                              <Send size={12} /><span>Enviados</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'drafts') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'drafts')}>
                              <FileText size={12} /><span>Borradores</span>
                              {unreadDraftsCount > 0 && isMailboxActive && <span className="submenu-count">{unreadDraftsCount}</span>}
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'trash') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'trash')}>
                              <Trash2 size={12} /><span>Papelera</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'settings') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'settings')}>
                              <Settings2 size={12} /><span>Configuración</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'tracking') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'tracking')}>
                              <CheckCheck size={12} /><span>Seguimiento</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="submenu-divider" style={{ margin: '10px 8px', opacity: 0.6 }} />

                  {/* Buzón de Marketing */}
                  {MAILBOXES.filter(m => m.email === 'marketing@fycheo.es' && isMailboxAllowed(m.email)).map(m => {
                    const unread = unreadPerMailbox[m.email] ?? 0;
                    const expanded = expandedMailboxes.includes(m.email);
                    const isMailboxActive = activeMailbox === m.email;
                    const displayName = mailboxCustomizations[m.email]?.displayName || m.label;
                    return (
                      <div key={m.email} className="mailbox-tree-item">
                        <button
                          className={`mailbox-tree-header ${isMailboxActive ? 'active' : ''}`}
                          onClick={() => toggleMailbox(m.email)}
                        >
                          <span className="mailbox-dot" style={{ background: mailboxCustomizations[m.email]?.color || m.color }} />
                          <span className="mailbox-tree-label">{displayName}</span>
                          {unread > 0 && <span className="submenu-count">{unread}</span>}
                          <span className="mailbox-tree-chevron">
                            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          </span>
                        </button>
                        {expanded && (
                          <div className="mailbox-tree-sub">
                            <button className={`submenu-item ${isActive(m.email, 'inbox') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'inbox')}>
                              <Inbox size={12} /><span>Recibidos</span>
                              {unread > 0 && <span className="submenu-count">{unread}</span>}
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'sent') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'sent')}>
                              <Send size={12} /><span>Enviados</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'drafts') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'drafts')}>
                              <FileText size={12} /><span>Borradores</span>
                              {unreadDraftsCount > 0 && isMailboxActive && <span className="submenu-count">{unreadDraftsCount}</span>}
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'trash') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'trash')}>
                              <Trash2 size={12} /><span>Papelera</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'settings') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'settings')}>
                              <Settings2 size={12} /><span>Configuración</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'campaigns') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'campaigns')}>
                              <Megaphone size={12} /><span>Campañas</span>
                            </button>
                            <button className={`submenu-item ${isActive(m.email, 'tracking') ? 'active' : ''}`}
                              onClick={() => goEmail(m.email, 'tracking')}>
                              <CheckCheck size={12} /><span>Seguimiento</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                 </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="avatar">
            {staffAvatar
              ? <img src={staffAvatar} alt={staffName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : staffName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
            }
          </div>
          <div className="profile-info">
            <p className="name">{staffName}</p>
            <p className="role">{staffRole}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="logout-btn" title="Cerrar sesión">
          <LogOut size={16} />
        </button>
      </div>

      <style>{`
        .sidebar-container {
          width: 260px;
          background-color: var(--bg-sidebar);
          border-right: 1px solid var(--border-color);
          height: 100vh;
          position: fixed;
          top: 0; left: 0;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          z-index: 100;
          overflow-y: auto;
        }
        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          padding: 0 8px;
        }
        .logo-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .logo-text h2 { font-size: 1.15rem; line-height: 1.1; color: var(--text-main); }
        .logo-text span { font-size: 0.65rem; color: var(--primary-light); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .sidebar-nav { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .nav-item-wrapper { display: flex; flex-direction: column; }
        .nav-item {
          display: flex; align-items: center; justify-content: space-between;
          background: transparent; border: none; color: var(--text-muted);
          padding: 12px 16px; border-radius: 10px; cursor: pointer;
          font-family: var(--font-sans); font-weight: 500; font-size: 0.9rem;
          text-align: left; width: 100%; transition: all var(--transition-fast);
        }
        .nav-item-content { display: flex; align-items: center; gap: 12px; }
        .nav-item:hover { color: var(--text-main); background: rgba(255,255,255,0.03); }
        .nav-item.active {
          color: white;
          background: linear-gradient(90deg, rgba(139,92,246,0.15) 0%, rgba(139,92,246,0.05) 100%);
          border-left: 3px solid var(--primary); font-weight: 600; padding-left: 13px;
        }
        .chevron-icon { display: flex; align-items: center; color: var(--text-darker); transition: color 0.2s; }
        .nav-item:hover .chevron-icon { color: var(--text-muted); }

        /* SUBMENU */
        .submenu-container {
          display: flex; flex-direction: column; gap: 2px;
          padding-left: 12px; margin-top: 4px; margin-bottom: 12px;
          border-left: 1px solid rgba(255,255,255,0.05); margin-left: 24px;
        }
        .btn-submenu-compose {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.08) 100%);
          border: 1px solid rgba(139,92,246,0.25); color: white; font-weight: 700;
          font-size: 0.8rem; padding: 8px 12px; border-radius: 8px; cursor: pointer;
          margin-bottom: 4px; transition: all var(--transition-fast);
        }
        .btn-submenu-compose:hover {
          background: linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(59,130,246,0.15) 100%);
          border-color: var(--primary-light); box-shadow: 0 0 10px rgba(139,92,246,0.15);
        }
        .submenu-item {
          display: flex; align-items: center; gap: 8px; background: transparent; border: none;
          color: var(--text-muted); padding: 6px 10px; border-radius: 7px; cursor: pointer;
          font-family: var(--font-sans); font-weight: 500; font-size: 0.78rem;
          text-align: left; width: 100%; transition: all var(--transition-fast);
        }
        .submenu-item:hover { color: var(--text-main); background: rgba(255,255,255,0.02); }
        .submenu-item.active { color: var(--primary-light); background: rgba(139,92,246,0.08); font-weight: 700; }
        .submenu-count {
          font-size: 0.68rem; background: rgba(139,92,246,0.18); color: var(--primary-light);
          padding: 1px 5px; border-radius: 100px; font-weight: 700; margin-left: auto;
        }
        .submenu-divider { height: 1px; background: var(--border-color); margin: 6px 8px; }
        .submenu-header-title {
          font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-darker); padding: 2px 10px; display: block;
        }

        /* ÁRBOL DE BUZONES */
        .mailbox-tree-item { display: flex; flex-direction: column; }
        .mailbox-tree-header {
          display: flex; align-items: center; gap: 7px; width: 100%;
          background: transparent; border: none; color: var(--text-muted);
          padding: 5px 10px; border-radius: 7px; cursor: pointer;
          font-family: var(--font-sans); font-size: 0.8rem; font-weight: 600;
          text-align: left; transition: all var(--transition-fast);
        }
        .mailbox-tree-header:hover { color: var(--text-main); background: rgba(255,255,255,0.03); }
        .mailbox-tree-header.active { color: var(--text-main); }
        .mailbox-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mailbox-tree-label { flex: 1; }
        .mailbox-tree-chevron { color: var(--text-darker); display: flex; align-items: center; }
        .mailbox-tree-sub {
          display: flex; flex-direction: column; gap: 1px;
          padding-left: 14px; margin: 1px 0 2px;
          border-left: 1px solid rgba(255,255,255,0.04); margin-left: 13px;
        }

        /* FOOTER */
        .sidebar-footer { border-top: 1px solid var(--border-color); padding-top: 20px; display: flex; align-items: center; justify-content: space-between; }
        .admin-profile { display: flex; align-items: center; gap: 10px; }
        .avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255,255,255,0.05); border: 1px solid var(--border-color);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.75rem; font-weight: 700; color: var(--primary-light); overflow: hidden;
        }
        .profile-info .name { font-size: 0.8rem; font-weight: 600; color: var(--text-main); line-height: 1.2; }
        .profile-info .role { font-size: 0.65rem; color: var(--text-darker); }
        .logout-btn {
          background: transparent; border: none; color: var(--text-darker);
          cursor: pointer; padding: 8px; border-radius: 6px; transition: all var(--transition-fast);
        }
        .logout-btn:hover { color: var(--danger-light); background: rgba(239,68,68,0.05); }
      `}</style>
    </aside>
  );
};
