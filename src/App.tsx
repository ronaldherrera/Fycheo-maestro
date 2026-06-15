import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Companies } from './pages/Companies';
import { Employees } from './pages/Employees';
import { EmailsCenter } from './pages/EmailsCenter';
import { AuditLogs } from './pages/AuditLogs';
import { Staff } from './pages/Staff';
import { Demos } from './pages/Demos';
import { ContactRequests } from './pages/ContactRequests';
import { LoginScreen } from './pages/LoginScreen';
import { Support } from './pages/Support';
import { Finanzas } from './pages/Finanzas';
import { Marketing } from './pages/Marketing';
import { Cuaderno } from './pages/Cuaderno';
import { Email } from './types';
import { initialEmails } from './mockData';
import { supabase } from './lib/supabase';
import { MAILBOXES } from './lib/mailboxes';
import { fetchMailboxSettings, MailboxSettings } from './lib/emailService';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('fycheo_active_tab') ?? 'dashboard');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('');
  const [staffAvatar, setStaffAvatar] = useState('');
  const [allowedScreens, setAllowedScreens] = useState<string[]>([]);
  const [allowedMailboxes, setAllowedMailboxes] = useState<string[]>([]);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadStaffData = async (staffRecord: any, session: any) => {
    setStaffName(staffRecord.name);
    setStaffRole(staffRecord.role.charAt(0).toUpperCase() + staffRecord.role.slice(1));
    setStaffAvatar(
      staffRecord.avatar_url ||
      session.user.user_metadata?.avatar_url ||
      session.user.user_metadata?.picture ||
      ''
    );
    const perms = staffRecord.permissions ?? {};
    setAllowedScreens(Array.isArray(perms.screens)   ? perms.screens   : []);
    setAllowedMailboxes(Array.isArray(perms.mailboxes) ? perms.mailboxes : []);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        setIsAuthenticated(false);
        setLoadingSession(false);
        return;
      }

      // 1. Buscar por user_id (usuarios ya vinculados)
      const { data: byId } = await supabase
        .from('maestro_staff')
        .select('name, role, avatar_url, permissions')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .single();

      if (byId) {
        // Usuario conocido y activo
        await loadStaffData(byId, session);
        setIsAuthenticated(true);
        setLoadingSession(false);
        return;
      }

      // 2. No encontrado por user_id → intentar auto-vincular por email
      const { data: linked } = await supabase.rpc('link_maestro_staff_user');

      if (linked) {
        // Vinculación exitosa en primer login
        await loadStaffData(linked, session);
        setIsAuthenticated(true);
        setLoadingSession(false);
        return;
      }

      // 3. No está en maestro_staff → acceso denegado
      await supabase.auth.signOut();
      setIsAuthenticated(false);
      setAccessDenied(true);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
  };
  const [emails, setEmails] = useState<Email[]>(initialEmails);
  const [emailsFolder, setEmailsFolder] = useState<'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking'>(
    () => (localStorage.getItem('fycheo_emails_folder') as any) ?? 'inbox'
  );
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composePreset, setComposePreset] = useState<{
    to: string;
    subject: string;
    body: string;
    from?: string;
    contactId?: string;
  } | null>(null);
  const [activeMailbox, setActiveMailbox] = useState<string>(
    () => localStorage.getItem('fycheo_active_mailbox') ?? 'all'
  );

  useEffect(() => { localStorage.setItem('fycheo_active_tab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('fycheo_emails_folder', emailsFolder); }, [emailsFolder]);
  useEffect(() => { localStorage.setItem('fycheo_active_mailbox', activeMailbox); }, [activeMailbox]);
  
  const [mailboxCustomizations, setMailboxCustomizations] = useState<Record<string, { displayName: string; avatar: string; color: string }>>(() => {
    try {
      return JSON.parse(localStorage.getItem('fycheo_mailbox_customizations') ?? '{}');
    } catch {
      return {};
    }
  });

  const [mailboxSettingsMap, setMailboxSettingsMap] = useState<Record<string, MailboxSettings>>({});
  useEffect(() => { fetchMailboxSettings().then(map => setMailboxSettingsMap(map)); }, []);

  const [unreadContactsCount, setUnreadContactsCount] = useState(0);
  const [supportPreselectedId, setSupportPreselectedId] = useState<string | null>(null);
  const [marketingSection, setMarketingSection] = useState('campañas');
  const [cuadernoSection, setCuadernoSection] = useState<'notas' | 'agenda' | 'enlaces'>('notas');

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('contact_messages')
          .select('*', { count: 'exact', head: true })
          .eq('read', false)
          .is('trashed_at', null);
        if (!error) {
          setUnreadContactsCount(count || 0);
        }
      } catch (err) {
        console.error('[App] Error al obtener contador de contactos sin leer:', err);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('contact_messages_sidebar')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_messages' },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated]);

  const unreadInboxCount = emails.filter(e => e.folder === 'inbox' && !e.read).length;
  const unreadDraftsCount = emails.filter(e => e.folder === 'drafts' && !e.read).length;

  const unreadPerMailbox = emails.reduce<Record<string, number>>((acc, e) => {
    if (!e.read && e.folder === 'inbox' && e.toEmail) {
      const m = MAILBOXES.find(mbox => mbox.email === e.toEmail);
      if (m?.inbox) {
        acc[e.toEmail] = (acc[e.toEmail] ?? 0) + 1;
      }
    }
    return acc;
  }, {});

  // Redirigir al dashboard si la pestaña activa no está en los permisos
  const effectiveTab = (
    allowedScreens.length === 0 || allowedScreens.includes(activeTab)
  ) ? activeTab : 'dashboard';

  const renderContent = () => {
    switch (effectiveTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'companies':
        return <Companies />;
      case 'employees':
        return <Employees />;
      case 'emails':
        return (
          <EmailsCenter
            emails={emails}
            setEmails={setEmails}
            activeFolder={emailsFolder}
            setActiveFolder={setEmailsFolder}
            isComposeOpen={isComposeOpen}
            setIsComposeOpen={setIsComposeOpen}
            activeMailbox={activeMailbox}
            mailboxCustomizations={mailboxCustomizations}
            setMailboxCustomizations={setMailboxCustomizations}
            mailboxSettingsMap={mailboxSettingsMap}
            setMailboxSettingsMap={setMailboxSettingsMap}
            composePreset={composePreset}
            setComposePreset={setComposePreset}
            allowedMailboxes={allowedMailboxes}
          />
        );
      case 'demos':
        return <Demos />;
      case 'contacts':
        return (
          <ContactRequests
            setIsComposeOpen={setIsComposeOpen}
            setComposePreset={setComposePreset}
          />
        );
      case 'logs':
        return <AuditLogs />;
      case 'support':
        return (
          <Support
            setIsComposeOpen={setIsComposeOpen}
            setComposePreset={setComposePreset}
            preselectedAccountId={supportPreselectedId}
          />
        );
      case 'finanzas':
        return <Finanzas onGoToSupport={(id) => { setSupportPreselectedId(id); setActiveTab('support'); }} />;
      case 'marketing':
        return <Marketing section={marketingSection} />;
      case 'staff':
        return <Staff />;
      case 'cuaderno':
        return <Cuaderno section={cuadernoSection} onSectionChange={setCuadernoSection} />;
      default:
        return <Dashboard />;
    }
  };

  if (loadingSession) {
    return (
      <div style={{ minHeight: '100vh', background: '#090B10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} accessDenied={accessDenied} onDismissError={() => setAccessDenied(false)} />;
  }

  return (
    <div className="app-container">
      {/* Decorative premium floating glowing bubbles */}
      <div className="glowing-bg" />
      
      {/* Navigation menu */}
      <Sidebar
        activeTab={effectiveTab}
        setActiveTab={setActiveTab}
        emailsFolder={emailsFolder}
        setEmailsFolder={setEmailsFolder}
        isComposeOpen={isComposeOpen}
        setIsComposeOpen={setIsComposeOpen}
        unreadInboxCount={unreadInboxCount}
        unreadDraftsCount={unreadDraftsCount}
        onSignOut={handleSignOut}
        staffName={staffName}
        staffRole={staffRole}
        staffAvatar={staffAvatar}
        activeMailbox={activeMailbox}
        setActiveMailbox={setActiveMailbox}
        unreadPerMailbox={unreadPerMailbox}
        mailboxCustomizations={mailboxCustomizations}
        mailboxSettingsMap={mailboxSettingsMap}
        unreadContactsCount={unreadContactsCount}
        allowedScreens={allowedScreens}
        allowedMailboxes={allowedMailboxes}
        marketingSection={marketingSection}
        setMarketingSection={setMarketingSection}
        cuadernoSection={cuadernoSection}
        setCuadernoSection={setCuadernoSection}
      />
      
      {/* Main content display */}
      <main className="main-content">
        {renderContent()}
      </main>

      {/* Renderizador silencioso del redactor global si está abierto en otra pestaña */}
      {isComposeOpen && effectiveTab !== 'emails' && (
        <EmailsCenter
          emails={emails}
          setEmails={setEmails}
          activeFolder={emailsFolder}
          setActiveFolder={setEmailsFolder}
          isComposeOpen={isComposeOpen}
          setIsComposeOpen={setIsComposeOpen}
          activeMailbox={activeMailbox}
          mailboxCustomizations={mailboxCustomizations}
          setMailboxCustomizations={setMailboxCustomizations}
          mailboxSettingsMap={mailboxSettingsMap}
          setMailboxSettingsMap={setMailboxSettingsMap}
          composePreset={composePreset}
          setComposePreset={setComposePreset}
          onlyCompose={true}
          allowedMailboxes={allowedMailboxes}
        />
      )}
    </div>
  );
}

export default App;
