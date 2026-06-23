import React, { useState, useEffect, useCallback, useRef } from 'react';
import { formatDate, formatDateTime } from '../lib/utils';
import {
  ArrowLeft,
  Send,
  FileText, 
  AlertCircle, 
  RefreshCw,
  Search,
  Inbox,
  Star,
  Trash2,
  Tag,
  Paperclip,
  Maximize2,
  Minimize2,
  X,
  CornerUpLeft,
  Clock,
  Filter,
  CheckSquare,
  Square,
  Layers,
  User,
  Mail,
  Megaphone,
  BarChart2,
  Smartphone,
  Monitor,
  Users,
  Calendar,
  Percent,
  Plus,
  Save,
  Download,
  Image as ImageIcon,
  FileArchive,
  Check,
  CheckCheck,
  MousePointerClick,
  FileDown,
  ExternalLink,
  Sparkles,
  Settings2,
  ChevronDown,
  Pencil,
  Info,
  Eye,
  Code2,
  Link,
  Type,
  PenLine,
  Globe,
  Paintbrush,
  MailCheck,
  ChevronLeft,
  ChevronRight,
  Forward,
  ToggleLeft,
  ToggleRight,
  Trash,
  MessageSquareOff,
} from 'lucide-react';
import { Email, Campaign, MailTemplate } from '../types';
import { initialCampaigns, initialTemplates } from '../mockData';
import { MAILBOXES, loadSignatures, saveSignatures } from '../lib/mailboxes';
import { supabase } from '../lib/supabase';
import { CustomSelect } from '../components/CustomSelect';
import {
  fetchContactMessages,
  markContactRead,
  markContactStarred,
  markContactImportant,
  markContactReplied,
  fetchInboundEmails,
  markInboundRead,
  markInboundStarred,
  markInboundImportant,
  markInboundReplied,
  sendEmail,
  syncInbox,
  saveSentEmail,
  fetchSentEmails,
  trashSentEmail,
  markSentStarred,
  markSentImportant,
  trashContactMessage,
  trashInboundEmail,
  fetchTrashedEmails,
  emptyTrashFromSupabase,
  autoDeleteOldTrash,
  restoreContactMessage,
  restoreInboundEmail,
  restoreSentEmail,
  deleteContactMessage,
  deleteInboundEmail,
  deleteSentEmail,
  saveMailboxSettings,
  MailboxSettings,
} from '../lib/emailService';

export interface MailboxLabel {
  id: string;
  name: string;
  color: string;
}

const defaultLabels: Record<string, MailboxLabel[]> = {
  'all': [
    { id: 'l_urg', name: 'Urgente', color: '#ef4444' },
    { id: 'l_sop', name: 'Soporte', color: '#3b82f6' },
    { id: 'l_fact', name: 'Factura', color: '#10b981' }
  ],
  'hola@fycheo.es': [
    { id: 'l_urg', name: 'Urgente', color: '#ef4444' },
    { id: 'l_sop', name: 'Soporte', color: '#3b82f6' },
    { id: 'l_fact', name: 'Factura', color: '#10b981' }
  ],
  'soporte@fycheo.es': [
    { id: 'l_urg', name: 'Urgente', color: '#ef4444' },
    { id: 'l_bug', name: 'Bug/Error', color: '#f59e0b' },
    { id: 'l_ticket', name: 'Ticket Abierto', color: '#8b5cf6' }
  ],
  'administracion@fycheo.es': [
    { id: 'l_fact', name: 'Factura', color: '#10b981' },
    { id: 'l_admin', name: 'Trámite', color: '#6b7280' }
  ],
  'marketing@fycheo.es': [
    { id: 'l_news', name: 'Boletín', color: '#06b6d4' },
    { id: 'l_lead', name: 'Interesado', color: '#ec4899' }
  ]
};

interface EmailsCenterProps {
  emails: Email[];
  setEmails: React.Dispatch<React.SetStateAction<Email[]>>;
  activeFolder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking';
  setActiveFolder: (folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns' | 'settings' | 'tracking') => void;
  isComposeOpen: boolean;
  setIsComposeOpen: (open: boolean) => void;
  activeMailbox: string;
  mailboxCustomizations: Record<string, { displayName: string; avatar: string; color: string }>;
  setMailboxCustomizations: React.Dispatch<React.SetStateAction<Record<string, { displayName: string; avatar: string; color: string }>>>;
  mailboxSettingsMap: Record<string, MailboxSettings>;
  setMailboxSettingsMap: React.Dispatch<React.SetStateAction<Record<string, MailboxSettings>>>;
  composePreset: { to: string; subject: string; body: string; from?: string; contactId?: string } | null;
  setComposePreset: (preset: { to: string; subject: string; body: string; from?: string; contactId?: string } | null) => void;
  onlyCompose?: boolean;
  allowedMailboxes?: string[];
}


export const EmailsCenter: React.FC<EmailsCenterProps> = ({
  emails,
  setEmails,
  activeFolder,
  setActiveFolder,
  isComposeOpen,
  setIsComposeOpen,
  activeMailbox,
  mailboxCustomizations,
  setMailboxCustomizations,
  mailboxSettingsMap,
  setMailboxSettingsMap,
  composePreset,
  setComposePreset,
  onlyCompose = false,
  allowedMailboxes = [],
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [templates, setTemplates] = useState<MailTemplate[]>(initialTemplates);

  // Buzones filtrados por permisos del colaborador
  const filteredMailboxes = allowedMailboxes.length > 0
    ? MAILBOXES.filter(m => allowedMailboxes.includes(m.email))
    : MAILBOXES;

  // Firmas por buzón (persistidas en localStorage)
  const [mailboxSignatures, setMailboxSignatures] = useState<Record<string, string>>(loadSignatures);
  
  // Estado para sistema de notificaciones premium (toasts)
  const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

  // Estado para las etiquetas personalizadas por buzón
  const [mailboxLabels, setMailboxLabels] = useState<Record<string, MailboxLabel[]>>(() => {
    try {
      const saved = localStorage.getItem('fycheo_mailbox_labels');
      return saved ? JSON.parse(saved) : defaultLabels;
    } catch {
      return defaultLabels;
    }
  });

  const [selectedFilterLabels, setSelectedFilterLabels] = useState<string[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isNewLabelModalOpen, setIsNewLabelModalOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#8b5cf6');
  
  // Estado de etiquetas para redacción y visualización
  const [composeLabels, setComposeLabels] = useState<string[]>([]);
  const [isAddLabelDropdownOpen, setIsAddLabelDropdownOpen] = useState(false);
  const [editingLabelColorId, setEditingLabelColorId] = useState<string | null>(null);
  const [isEditingLabelsMode, setIsEditingLabelsMode] = useState(false);
  const [isComposeLabelsDropdownOpen, setIsComposeLabelsDropdownOpen] = useState(false);

  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const addLabelDropdownRef = useRef<HTMLDivElement>(null);
  const [, setEmailBodyHeight] = useState(0);
  const composeLabelsDropdownRef = useRef<HTMLDivElement>(null);
  const previewDivRef = useRef<HTMLDivElement>(null);

  // Limpiar filtros cuando cambia el buzón activo
  useEffect(() => {
    setSelectedFilterLabels([]);
    setIsFilterDropdownOpen(false);
    setIsEditingLabelsMode(false);
    setEditingLabelColorId(null);
  }, [activeMailbox]);

  // Cerrar el dropdown de filtros al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
        setIsEditingLabelsMode(false);
        setEditingLabelColorId(null);
      }
    };
    if (isFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterDropdownOpen]);

  // Cerrar el dropdown de añadir etiqueta al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addLabelDropdownRef.current && !addLabelDropdownRef.current.contains(event.target as Node)) {
        setIsAddLabelDropdownOpen(false);
      }
    };
    if (isAddLabelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAddLabelDropdownOpen]);

  // Cerrar el dropdown de etiquetas del Composer al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (composeLabelsDropdownRef.current && !composeLabelsDropdownRef.current.contains(event.target as Node)) {
        setIsComposeLabelsDropdownOpen(false);
      }
    };
    if (isComposeLabelsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isComposeLabelsDropdownOpen]);


  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);
  const [sigDraft, setSigDraft] = useState<Record<string, string>>(loadSignatures);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Persistir email seleccionado
  useEffect(() => {
    if (selectedEmail) localStorage.setItem('fycheo_selected_email_id', selectedEmail.id);
    else localStorage.removeItem('fycheo_selected_email_id');
  }, [selectedEmail]);

  // Configuración de Bandeja
  const [settingsMailbox, setSettingsMailbox] = useState(activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox);
  const [settingsTab, setSettingsTab] = useState<'personalization' | 'templates' | 'signatures' | 'inbox'>('personalization');
  const [savingInboxSettings, setSavingInboxSettings] = useState(false);
  const [inboxSettingsDraft, setInboxSettingsDraft] = useState<Record<string, MailboxSettings>>({});
  const [tempDisplayName, setTempDisplayName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');
  const [tempColor, setTempColor] = useState('');

  // Sync temp values when selected mailbox changes
  useEffect(() => {
    setTempDisplayName(mailboxCustomizations[settingsMailbox]?.displayName || MAILBOXES.find(m => m.email === settingsMailbox)?.displayName || '');
    setTempAvatar(mailboxCustomizations[settingsMailbox]?.avatar || MAILBOXES.find(m => m.email === settingsMailbox)?.label.slice(0, 2).toUpperCase() || '');
    setTempColor(mailboxCustomizations[settingsMailbox]?.color || MAILBOXES.find(m => m.email === settingsMailbox)?.color || '#6366f1');
  }, [settingsMailbox, mailboxCustomizations]);

  // Sync settingsMailbox when activeMailbox prop changes from the sidebar
  useEffect(() => {
    if (activeMailbox !== 'all') {
      setSettingsMailbox(activeMailbox);
    }
  }, [activeMailbox]);

  // Sincronizar borrador de firmas cuando cambian las firmas guardadas
  useEffect(() => {
    setSigDraft({ ...mailboxSignatures });
  }, [mailboxSignatures]);

  // Determinar si una cadena es una imagen de avatar (base64 o URL)
  const isImageAvatar = (avatarStr: string | undefined): boolean => {
    if (!avatarStr) return false;
    return (
      avatarStr.startsWith('http://') ||
      avatarStr.startsWith('https://') ||
      avatarStr.startsWith('/') ||
      avatarStr.startsWith('data:image/')
    );
  };



  const gravatarUrl = (email: string): string => {
    // MD5 simple para Gravatar
    const md5 = (str: string): string => {
      const safe_add = (x: number, y: number) => { const lsw=(x&0xFFFF)+(y&0xFFFF); return (((x>>16)+(y>>16)+(lsw>>16))<<16)|(lsw&0xFFFF); };
      const bit_rol = (num: number, cnt: number) => (num<<cnt)|(num>>>(32-cnt));
      const md5_cmn = (q:number,a:number,b:number,x:number,s:number,t:number) => safe_add(bit_rol(safe_add(safe_add(a,q),safe_add(x,t)),s),b);
      const md5_ff = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => md5_cmn((b&c)|((~b)&d),a,b,x,s,t);
      const md5_gg = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => md5_cmn((b&d)|(c&(~d)),a,b,x,s,t);
      const md5_hh = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => md5_cmn(b^c^d,a,b,x,s,t);
      const md5_ii = (a:number,b:number,c:number,d:number,x:number,s:number,t:number) => md5_cmn(c^(b|(~d)),a,b,x,s,t);
      const binl_md5 = (x: number[], len: number) => {
        x[len>>5] |= 0x80<<(len%32); x[(((len+64)>>>9)<<4)+14] = len;
        let a=1732584193,b=-271733879,c=-1732584194,d=271733878;
        for(let i=0;i<x.length;i+=16){
          const [oa,ob,oc,od]=[a,b,c,d];
          a=md5_ff(a,b,c,d,x[i],7,-680876936);d=md5_ff(d,a,b,c,x[i+1],12,-389564586);c=md5_ff(c,d,a,b,x[i+2],17,606105819);b=md5_ff(b,c,d,a,x[i+3],22,-1044525330);
          a=md5_ff(a,b,c,d,x[i+4],7,-176418897);d=md5_ff(d,a,b,c,x[i+5],12,1200080426);c=md5_ff(c,d,a,b,x[i+6],17,-1473231341);b=md5_ff(b,c,d,a,x[i+7],22,-45705983);
          a=md5_ff(a,b,c,d,x[i+8],7,1770035416);d=md5_ff(d,a,b,c,x[i+9],12,-1958414417);c=md5_ff(c,d,a,b,x[i+10],17,-42063);b=md5_ff(b,c,d,a,x[i+11],22,-1990404162);
          a=md5_ff(a,b,c,d,x[i+12],7,1804603682);d=md5_ff(d,a,b,c,x[i+13],12,-40341101);c=md5_ff(c,d,a,b,x[i+14],17,-1502002290);b=md5_ff(b,c,d,a,x[i+15],22,1236535329);
          a=md5_gg(a,b,c,d,x[i+1],5,-165796510);d=md5_gg(d,a,b,c,x[i+6],9,-1069501632);c=md5_gg(c,d,a,b,x[i+11],14,643717713);b=md5_gg(b,c,d,a,x[i],20,-373897302);
          a=md5_gg(a,b,c,d,x[i+5],5,-701558691);d=md5_gg(d,a,b,c,x[i+10],9,38016083);c=md5_gg(c,d,a,b,x[i+15],14,-660478335);b=md5_gg(b,c,d,a,x[i+4],20,-405537848);
          a=md5_gg(a,b,c,d,x[i+9],5,568446438);d=md5_gg(d,a,b,c,x[i+14],9,-1019803690);c=md5_gg(c,d,a,b,x[i+3],14,-187363961);b=md5_gg(b,c,d,a,x[i+8],20,1163531501);
          a=md5_gg(a,b,c,d,x[i+13],5,-1444681467);d=md5_gg(d,a,b,c,x[i+2],9,-51403784);c=md5_gg(c,d,a,b,x[i+7],14,1735328473);b=md5_gg(b,c,d,a,x[i+12],20,-1926607734);
          a=md5_hh(a,b,c,d,x[i+5],4,-378558);d=md5_hh(d,a,b,c,x[i+8],11,-2022574463);c=md5_hh(c,d,a,b,x[i+11],16,1839030562);b=md5_hh(b,c,d,a,x[i+14],23,-35309556);
          a=md5_hh(a,b,c,d,x[i+1],4,-1530992060);d=md5_hh(d,a,b,c,x[i+4],11,1272893353);c=md5_hh(c,d,a,b,x[i+7],16,-155497632);b=md5_hh(b,c,d,a,x[i+10],23,-1094730640);
          a=md5_hh(a,b,c,d,x[i+13],4,681279174);d=md5_hh(d,a,b,c,x[i],11,-358537222);c=md5_hh(c,d,a,b,x[i+3],16,-722521979);b=md5_hh(b,c,d,a,x[i+6],23,76029189);
          a=md5_hh(a,b,c,d,x[i+9],4,-640364487);d=md5_hh(d,a,b,c,x[i+12],11,-421815835);c=md5_hh(c,d,a,b,x[i+15],16,530742520);b=md5_hh(b,c,d,a,x[i+2],23,-995338651);
          a=md5_ii(a,b,c,d,x[i],6,-198630844);d=md5_ii(d,a,b,c,x[i+7],10,1126891415);c=md5_ii(c,d,a,b,x[i+14],15,-1416354905);b=md5_ii(b,c,d,a,x[i+5],21,-57434055);
          a=md5_ii(a,b,c,d,x[i+12],6,1700485571);d=md5_ii(d,a,b,c,x[i+3],10,-1894986606);c=md5_ii(c,d,a,b,x[i+10],15,-1051523);b=md5_ii(b,c,d,a,x[i+1],21,-2054922799);
          a=md5_ii(a,b,c,d,x[i+8],6,1873313359);d=md5_ii(d,a,b,c,x[i+15],10,-30611744);c=md5_ii(c,d,a,b,x[i+6],15,-1560198380);b=md5_ii(b,c,d,a,x[i+13],21,1309151649);
          a=md5_ii(a,b,c,d,x[i+4],6,-145523070);d=md5_ii(d,a,b,c,x[i+11],10,-1120210379);c=md5_ii(c,d,a,b,x[i+2],15,718787259);b=md5_ii(b,c,d,a,x[i+9],21,-343485551);
          a=safe_add(a,oa);b=safe_add(b,ob);c=safe_add(c,oc);d=safe_add(d,od);
        }
        return [a,b,c,d];
      };
      const str2binl = (s: string) => { const b: number[]=[]; for(let i=0;i<s.length*8;i+=8) b[i>>5]|=(s.charCodeAt(i/8)&0xFF)<<(i%32); return b; };
      const binl2hex = (b: number[]) => { const h='0123456789abcdef'; let s=''; for(let i=0;i<b.length*4;i++) s+=h[(b[i>>2]>>((i%4)*8+4))&0xF]+h[(b[i>>2]>>((i%4)*8))&0xF]; return s; };
      const s = str.toLowerCase().trim();
      return binl2hex(binl_md5(str2binl(s), s.length*8));
    };
    return `https://www.gravatar.com/avatar/${md5(email)}?s=64&d=blank`;
  };

  // ─── CONTACTOS REALES DE SUPABASE ───
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactSyncStatus, setContactSyncStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [nextSyncIn, setNextSyncIn] = useState(600); // segundos hasta la próxima sync

  const loadContactMessages = useCallback(async () => {
    setIsLoadingContacts(true);
    setContactSyncStatus('loading');
    try {
      // 1. Descarga correos nuevos del IMAP de Hostinger → los guarda en inbound_emails
      await syncInbox();

      // 2. Lee contact_messages + inbound_emails + sent_emails + papelera de Supabase
      autoDeleteOldTrash();
      const [contactEmails, inboundEmails, rawSentEmails, trashedEmails] = await Promise.all([
        fetchContactMessages(),
        fetchInboundEmails(),
        fetchSentEmails(),
        fetchTrashedEmails(),
      ]);
      // Reemplazar avatar de enviados con la foto configurada en el buzón
      const sentEmails = rawSentEmails.map(e => {
        const mbAvatar = mailboxCustomizations[e.senderEmail]?.avatar;
        return mbAvatar ? { ...e, avatar: mbAvatar } : e;
      });
      const allEmails = [...contactEmails, ...inboundEmails, ...sentEmails, ...trashedEmails];
      setEmails(() => allEmails);
      // Restaurar email seleccionado tras recarga
      const savedId = localStorage.getItem('fycheo_selected_email_id');
      if (savedId) {
        const found = allEmails.find(e => e.id === savedId);
        if (found) setSelectedEmail(found);
      }
      setContactSyncStatus('ok');
      setLastSyncTime(new Date());
      setNextSyncIn(600);
    } catch {
      setContactSyncStatus('error');
    } finally {
      setIsLoadingContacts(false);
    }
  }, [setEmails, mailboxCustomizations]);

  // Carga inicial
  useEffect(() => {
    loadContactMessages();
  }, [loadContactMessages]);


  // Cerrar correo abierto al cambiar de carpeta o buzón
  useEffect(() => {
    setSelectedEmail(null);
  }, [activeFolder, activeMailbox]);

  // Escuchar altura del iframe del correo vía postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.t === 'emailH' && e.data.v > 50) {
        setEmailBodyHeight(e.data.v);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Resetear altura al cambiar de correo
  useEffect(() => {
    setEmailBodyHeight(0);
  }, [selectedEmail?.id]);

  // Quitar padding del main-content cuando hay un correo abierto
  useEffect(() => {
    const el = document.querySelector('.main-content') as HTMLElement | null;
    if (!el) return;
    if (selectedEmail) {
      el.style.padding = '0';
    } else {
      el.style.padding = '';
    }
    return () => { el.style.padding = ''; };
  }, [selectedEmail]);

  // Realtime: actualización silenciosa de la información de seguimiento del correo enviado
  useEffect(() => {
    const channel = supabase
      .channel('sent_emails_tracking')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sent_emails' },
        (payload) => {
          const updated = payload.new as {
            id: string; subject: string; to_email: string;
            tracking_status: string; opened_at: string | null;
            opens_data: { opened_at: string }[] | null;
            clicks_data: { url: string; clicksCount: number; firstClickedAt?: string; lastClickedAt?: string }[] | null;
          };

          // Actualizar estado local del correo
          setEmails(prev => {
            const newOpens = updated.opens_data ?? [];
            const newClicks = updated.clicks_data ?? [];
            return prev.map(e => {
              if (e._sentId !== updated.id) return e;
              return {
                ...e,
                tracking: {
                  ...e.tracking,
                  status: updated.tracking_status as 'sent' | 'delivered' | 'opened',
                  openedAt: updated.opened_at
                    ? formatDateTime(updated.opened_at)
                    : undefined,
                  opens: newOpens,
                  clicks: newClicks,
                  downloads: [],
                },
              };
            });
          });

          // Actualizar en caliente selectedEmail si coincide con el modificado
          setSelectedEmail(prev => {
            if (prev && prev._sentId === updated.id) {
              const newClicks = updated.clicks_data ?? [];
              return {
                ...prev,
                tracking: {
                  ...prev.tracking,
                  status: updated.tracking_status as 'sent' | 'delivered' | 'opened',
                  openedAt: updated.opened_at
                    ? formatDateTime(updated.opened_at)
                    : undefined,
                  opens: updated.opens_data ?? [],
                  clicks: newClicks,
                  downloads: [],
                }
              };
            }
            return prev;
          });

          // Actualizar en caliente trackingEmail si coincide con el modificado y el modal está abierto
          setTrackingEmail(prev => {
            if (prev && prev._sentId === updated.id) {
              const newClicks = updated.clicks_data ?? [];
              return {
                ...prev,
                tracking: {
                  ...prev.tracking,
                  status: updated.tracking_status as 'sent' | 'delivered' | 'opened',
                  openedAt: updated.opened_at
                    ? formatDateTime(updated.opened_at)
                    : undefined,
                  opens: updated.opens_data ?? [],
                  clicks: newClicks,
                  downloads: [],
                }
              };
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [setEmails]);

  // Auto-sincronización cada 10 minutos
  useEffect(() => {
    const autoSyncInterval = setInterval(() => {
      loadContactMessages();
    }, 10 * 60 * 1000); // 10 minutos

    return () => clearInterval(autoSyncInterval);
  }, [loadContactMessages]);

  // Countdown visual hasta próxima sync
  useEffect(() => {
    if (contactSyncStatus !== 'ok') return;
    const countdownInterval = setInterval(() => {
      setNextSyncIn(prev => (prev <= 1 ? 600 : prev - 1));
    }, 1000);
    return () => clearInterval(countdownInterval);
  }, [contactSyncStatus]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatLastSync = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // ─── ESTADO DEL MODAL DE RESPUESTA ───
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Asistente de Campaña de Mailing
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignTarget, setCampaignTarget] = useState('all');
  const [campaignBody, setCampaignBody] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [campaignDate, setCampaignDate] = useState('');

  // Gestor de Plantillas (Template Manager)
  const [selectedTemplate, setSelectedTemplate] = useState<MailTemplate | null>(initialTemplates[0]);
  const [editingTemplateName, setEditingTemplateName] = useState(initialTemplates[0].name);
  const [editingTemplateSubject, setEditingTemplateSubject] = useState(initialTemplates[0].subject);
  const [editingTemplateContent, setEditingTemplateContent] = useState(initialTemplates[0].content);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templatePreviewMode, setTemplatePreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [openTagGroups, setOpenTagGroups] = useState<string[]>([]);
  const toggleTagGroup = (group: string) => setOpenTagGroups(prev => prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]);

  const getRenderedTemplatePreview = (content: string) => {
    if (!content) return '';
    return content
      .replace(/{full_name}/g, 'Carlos Gómez')
      .replace(/{first_name}/g, 'Carlos')
      .replace(/{last_name}/g, 'Gómez')
      .replace(/{email}/g, 'carlos.gomez@empresa.es')
      .replace(/{role}/g, 'Empleado')
      .replace(/{company_name}/g, 'Fycheo Tech S.L.')
      .replace(/{company_id}/g, 'FYC-001')
      .replace(/{activation_link}/g, 'https://fycheo.co/activate-demo-account-token')
      .replace(/{reset_link}/g, 'https://fycheo.co/reset-password?token=demo')
      .replace(/{login_link}/g, 'https://fycheo.co/login')
      .replace(/{date}/g, new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }))
      .replace(/{time}/g, new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
      .replace(/{check_in_time}/g, '08:32')
      .replace(/{check_out_time}/g, '17:05')
      .replace(/{work_hours}/g, '8h 33min');
  };

  // Estado para el modal de composición individual (Gmail)
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeContactId, setComposeContactId] = useState<string | null>(null);
  const [toInput, setToInput] = useState('');

  const addRecipient = (emailInput: string) => {
    const emails = emailInput.split(/[,;]/g).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    setComposeTo(prev => {
      const list = prev ? prev.split(',').map(e => e.trim()).filter(Boolean) : [];
      emails.forEach(email => {
        if (!list.includes(email)) {
          list.push(email);
        }
      });
      return list.join(', ');
    });
    setToInput('');
  };

  const removeRecipient = (indexToRemove: number) => {
    setComposeTo(prev => {
      const list = prev ? prev.split(',').map(e => e.trim()).filter(Boolean) : [];
      const filtered = list.filter((_, i) => i !== indexToRemove);
      return filtered.join(', ');
    });
  };
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sendIndividually, setSendIndividually] = useState(false);
  const [trackingEmail, setTrackingEmail] = useState<Email | null>(null);

  const [isComposeMaximized, setIsComposeMaximized] = useState(false);
  const [isSendingCompose, setIsSendingCompose] = useState(false);
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCcField, setShowCcField] = useState(false);
  const [showBccField, setShowBccField] = useState(false);
  const [composeTemplateId, setComposeTemplateId] = useState('none');
  const [composeViewMode, setComposeViewMode] = useState<'raw' | 'preview'>('preview');
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [signatureInserted, setSignatureInserted] = useState(false);
  const [showAlignDropdown, setShowAlignDropdown] = useState(false);
  const [currentAlign, setCurrentAlign] = useState<'justifyLeft'|'justifyCenter'|'justifyRight'>('justifyLeft');
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [currentFont, setCurrentFont] = useState<{ label: string; value: string }>({ label: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' });
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [currentSize, setCurrentSize] = useState('10');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkEditPopover, setLinkEditPopover] = useState<{ x: number; y: number; url: string; el: HTMLAnchorElement } | null>(null);
  const [linkEditUrl, setLinkEditUrl] = useState('');
  const [linkEditText, setLinkEditText] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [showTypographyPopover, setShowTypographyPopover] = useState(false);
  const savedLinkSelection = useRef<Range | null>(null);

  // Sincronizar el div de previsualización editable cuando composeBody cambia externamente
  useEffect(() => {
    if (composeViewMode === 'preview' && previewDivRef.current) {
      if (previewDivRef.current.innerHTML !== composeBody) {
        previewDivRef.current.innerHTML = composeBody;
      }
    }
  }, [composeBody, composeViewMode]);


  const wasComposeOpen = React.useRef(false);

  // Al abrir compose, limpiar el cuerpo o cargar el preset de contacto
  useEffect(() => {
    if (isComposeOpen) {
      if (!wasComposeOpen.current) {
        wasComposeOpen.current = true;
        if (composePreset) {
          setComposeFrom(composePreset.from || (activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox));
          setComposeTo(composePreset.to);
          setComposeSubject(composePreset.subject);
          setComposeBody(composePreset.body);
          setComposeContactId(composePreset.contactId || null);
          setComposeTemplateId('none');
          setSignatureInserted(false);
          setAttachments([]);
          setComposePreset(null); // Limpiar preset
        } else {
          const fromMailbox = activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox;
          setComposeFrom(fromMailbox);
          setComposeTo('');
          setComposeSubject('');
          setComposeBody('');
          setComposeContactId(null);
          setComposeTemplateId('none');
          setSignatureInserted(false);
          setAttachments([]);
        }
      }
    } else {
      wasComposeOpen.current = false;
    }
  }, [isComposeOpen, composePreset, setComposePreset, activeMailbox]);

  const handleComposeFromChange = (newFrom: string) => {
    setComposeFrom(newFrom);
    setComposeLabels([]);
  };

  // Crear nueva etiqueta en la bandeja activa
  const handleCreateLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    const activeMailboxEmail = activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox;
    const newLabel: MailboxLabel = {
      id: 'l_' + Date.now(),
      name: newLabelName.trim(),
      color: newLabelColor
    };
    const prevLabels = mailboxLabels[activeMailboxEmail] || [];
    const updated = {
      ...mailboxLabels,
      [activeMailboxEmail]: [...prevLabels, newLabel]
    };
    setMailboxLabels(updated);
    localStorage.setItem('fycheo_mailbox_labels', JSON.stringify(updated));
    
    setNewLabelName('');
    setIsNewLabelModalOpen(false);
    showToast(`Etiqueta "${newLabel.name}" creada con éxito en esta bandeja.`, 'success');
  };

  // Asociar o desasociar etiqueta de un correo
  const handleToggleLabelOnEmail = (emailId: string, labelId: string) => {
    setEmails(prev => prev.map(e => {
      if (e.id === emailId) {
        const prevLabels = e.labels || [];
        const newLabels = prevLabels.includes(labelId)
          ? prevLabels.filter(id => id !== labelId)
          : [...prevLabels, labelId];
        return { ...e, labels: newLabels };
      }
      return e;
    }));
    // Actualizar también selectedEmail para reflejar el cambio en caliente en el modal de detalles
    setSelectedEmail(prev => {
      if (prev && prev.id === emailId) {
        const prevLabels = prev.labels || [];
        const newLabels = prevLabels.includes(labelId)
          ? prevLabels.filter(id => id !== labelId)
          : [...prevLabels, labelId];
        return { ...prev, labels: newLabels };
      }
      return prev;
    });
  };

  // Borrar etiqueta de la bandeja activa
  const handleDeleteLabel = (labelId: string) => {
    const activeMailboxEmail = activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox;
    const prevLabels = mailboxLabels[activeMailboxEmail] || [];
    const updatedLabels = prevLabels.filter(lbl => lbl.id !== labelId);
    const updated = {
      ...mailboxLabels,
      [activeMailboxEmail]: updatedLabels
    };
    setMailboxLabels(updated);
    localStorage.setItem('fycheo_mailbox_labels', JSON.stringify(updated));

    // Limpiar del filtro si estaba seleccionada
    setSelectedFilterLabels(prev => prev.filter(id => id !== labelId));

    // Desasociar la etiqueta de todos los correos
    setEmails(prev => prev.map(e => {
      if (e.labels && e.labels.includes(labelId)) {
        return { ...e, labels: e.labels.filter(id => id !== labelId) };
      }
      return e;
    }));

    // Desasociar del correo seleccionado en detalle si coincide
    setSelectedEmail(prev => {
      if (prev && prev.labels && prev.labels.includes(labelId)) {
        return { ...prev, labels: prev.labels.filter(id => id !== labelId) };
      }
      return prev;
    });

    showToast('Etiqueta eliminada con éxito de esta bandeja.', 'success');
  };

  // Actualizar el color de una etiqueta
  const handleUpdateLabelColor = (labelId: string, newColor: string) => {
    const activeMailboxEmail = activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox;
    const prevLabels = mailboxLabels[activeMailboxEmail] || [];
    const updatedLabels = prevLabels.map(lbl => 
      lbl.id === labelId ? { ...lbl, color: newColor } : lbl
    );
    const updated = {
      ...mailboxLabels,
      [activeMailboxEmail]: updatedLabels
    };
    setMailboxLabels(updated);
    localStorage.setItem('fycheo_mailbox_labels', JSON.stringify(updated));
    showToast('Color de etiqueta actualizado.', 'success');
  };

  // Estados de selección múltiple de correos
  const [selectedEmailIds, setSelectedEmailIds] = useState<string[]>([]);

  // Modificar estados de un correo
  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(email => {
      if (email.id !== id) return email;
      const newStarred = !email.starred;
      if (email.isContact && email._contactId) markContactStarred(email._contactId, newStarred);
      if (email.isInbound && email._inboundId) markInboundStarred(email._inboundId, newStarred);
      if (email.isSent && email._sentId) markSentStarred(email._sentId, newStarred);
      return { ...email, starred: newStarred };
    }));
    if (selectedEmail?.id === id) {
      const newStarred = !selectedEmail.starred;
      setSelectedEmail(prev => prev ? { ...prev, starred: newStarred } : null);
    }
  };

  const toggleImportant = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(prev => prev.map(email => {
      if (email.id !== id) return email;
      const newImportant = !email.important;
      if (email.isContact && email._contactId) markContactImportant(email._contactId, newImportant);
      if (email.isInbound && email._inboundId) markInboundImportant(email._inboundId, newImportant);
      if (email.isSent && email._sentId) markSentImportant(email._sentId, newImportant);
      return { ...email, important: newImportant };
    }));
    if (selectedEmail?.id === id) {
      setSelectedEmail(prev => prev ? { ...prev, important: !prev.important } : null);
    }
  };

  const markAsRead = (id: string, read: boolean) => {
    setEmails(prev => prev.map(email => {
      if (email.id !== id) return email;
      if (email.isContact && email._contactId) markContactRead(email._contactId, read);
      if (email.isInbound && email._inboundId) markInboundRead(email._inboundId, read);
      return { ...email, read };
    }));
  };

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    setIsReplyModalOpen(false);
    setReplyBody('');
    markAsRead(email.id, true);
  };

  // Mover correos a la papelera (soft delete: trashed_at en Supabase)
  const moveSelectedToTrash = () => {
    const trashOne = (email: Email) => {
      if (email.isContact && email._contactId) trashContactMessage(email._contactId);
      else if (email.isInbound && email._inboundId) trashInboundEmail(email._inboundId);
      else if (email.isSent && email._sentId) trashSentEmail(email._sentId);
      return { ...email, folder: 'trash' as const };
    };

    if (selectedEmailIds.length === 0 && selectedEmail) {
      const trashed = trashOne(selectedEmail);
      setEmails(prev => prev.map(e => e.id === selectedEmail.id ? trashed : e));
      setSelectedEmail(null);
    } else {
      setEmails(prev => prev.map(e =>
        selectedEmailIds.includes(e.id) ? trashOne(e) : e
      ));
      setSelectedEmailIds([]);
    }
  };

  // Vaciar papelera permanentemente (borra de Supabase y del estado)
  const emptyTrash = async () => {
    if (confirm('¿Estás seguro de que quieres vaciar la papelera de forma permanente?')) {
      await emptyTrashFromSupabase();
      setEmails(prev => prev.filter(email => email.folder !== 'trash'));
      setSelectedEmail(null);
    }
  };

  // Eliminar permanentemente (solo desde papelera)
  const deleteSelectedPermanently = async (targets?: Email[]) => {
    const toDel = targets ?? (selectedEmailIds.length > 0
      ? emails.filter(e => selectedEmailIds.includes(e.id))
      : selectedEmail ? [selectedEmail] : []);

    await Promise.all(toDel.map(email => {
      if (email.isContact && email._contactId) return deleteContactMessage(email._contactId);
      if (email.isInbound && email._inboundId) return deleteInboundEmail(email._inboundId);
      if (email.isSent && email._sentId) return deleteSentEmail(email._sentId);
      return Promise.resolve();
    }));

    const ids = new Set(toDel.map(e => e.id));
    setEmails(prev => prev.filter(e => !ids.has(e.id)));
    setSelectedEmailIds([]);
    if (selectedEmail && ids.has(selectedEmail.id)) setSelectedEmail(null);
  };

  // Restaurar correo(s) de la papelera a su bandeja original
  const restoreFromTrash = (targets?: Email[]) => {
    const toRestore = targets ?? (selectedEmailIds.length > 0
      ? emails.filter(e => selectedEmailIds.includes(e.id))
      : selectedEmail ? [selectedEmail] : []);

    toRestore.forEach(email => {
      if (email.isContact && email._contactId) restoreContactMessage(email._contactId);
      else if (email.isInbound && email._inboundId) restoreInboundEmail(email._inboundId);
      else if (email.isSent && email._sentId) restoreSentEmail(email._sentId);
    });

    const idsToRestore = new Set(toRestore.map(e => e.id));
    setEmails(prev => prev.map(e => {
      if (!idsToRestore.has(e.id)) return e;
      const originalFolder = e.isSent ? 'sent' : 'inbox';
      return { ...e, folder: originalFolder as Email['folder'] };
    }));
    setSelectedEmailIds([]);
    if (selectedEmail && idsToRestore.has(selectedEmail.id)) setSelectedEmail(null);
  };

  // Selección en lote
  const handleToggleSelectAll = () => {
    const visibleEmailIds = filteredEmails.map(e => e.id);
    const allSelected = visibleEmailIds.every(id => selectedEmailIds.includes(id));
    
    if (allSelected) {
      setSelectedEmailIds(prev => prev.filter(id => !visibleEmailIds.includes(id)));
    } else {
      setSelectedEmailIds(prev => [...new Set([...prev, ...visibleEmailIds])]);
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEmailIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Envío del nuevo correo individual via Resend
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo || !composeSubject || !composeBody) {
      showToast('Por favor, rellena todos los campos.', 'error');
      return;
    }

    setIsSendingCompose(true);

    const replaceLinksWithTracking = (html: string, emailId: string) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (match, url) => {
        if (url.includes('track-click')) return match;
        const trackingUrl = `${supabaseUrl}/functions/v1/track-click?id=${emailId}&url=${encodeURIComponent(url)}`;
        return `href="${trackingUrl}"`;
      });
    };

    const mailboxEmail = composeFrom || (activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox);
    const customName = mailboxCustomizations[mailboxEmail]?.displayName || MAILBOXES.find(m => m.email === mailboxEmail)?.displayName || 'Fycheo';
    const customAvatar = mailboxCustomizations[mailboxEmail]?.avatar || MAILBOXES.find(m => m.email === mailboxEmail)?.label.slice(0, 2).toUpperCase() || 'FM';
    const textBody = composeBody.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

    // Separar destinatarios por coma o punto y coma
    const targetEmails = composeTo
      .replace(/;/g, ',')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (targetEmails.length === 0) {
      showToast('Por favor, introduce al menos un destinatario válido.', 'error');
      setIsSendingCompose(false);
      return;
    }

    let successCount = 0;
    const errors: string[] = [];
    const newEmailsToAdd: Email[] = [];

    if (sendIndividually && targetEmails.length > 1) {
      // ENVIAR INDIVIDUALMENTE A CADA UNO
      for (const targetEmail of targetEmails) {
        try {
          // 1. Guardar primero en Supabase para obtener el ID (necesario para el pixel)
          const savedId = await saveSentEmail({
            from_email: mailboxEmail,
            from_name: customName,
            to_email: targetEmail,
            cc: showCcField && composeCc ? composeCc : undefined,
            bcc: showBccField && composeBcc ? composeBcc : undefined,
            subject: composeSubject,
            html_body: composeBody,
            text_body: textBody,
            labels: composeLabels,
          });

          // 2. Construir HTML con pixel de seguimiento y tracking de enlaces
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const trackedBody = savedId ? replaceLinksWithTracking(composeBody, savedId) : composeBody;
          const pixelUrl = savedId ? `${supabaseUrl}/functions/v1/track-open?id=${savedId}` : null;
          const trackingPixel = pixelUrl
            ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
            : '';
          const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background-color:transparent;">
  <div style="font-family:sans-serif;line-height:1.7;color:#1a1a2e;max-width:600px;">
    ${trackedBody}
    ${trackingPixel}
  </div>
</body>
</html>`;

          // 3. Enviar el correo
          const result = await sendEmail({
            to: targetEmail,
            subject: composeSubject,
            html: htmlBody,
            from: `${customName} <${mailboxEmail}>`,
            cc: showCcField && composeCc ? composeCc : undefined,
            bcc: showBccField && composeBcc ? composeBcc : undefined
          });

          if (result.success) {
            successCount++;
            if (savedId) {
              await supabase
                .from('sent_emails')
                .update({ tracking_status: 'delivered' })
                .eq('id', savedId);
            }
            if (composeContactId) {
              await supabase
                .from('contact_messages')
                .update({
                  replied: true,
                  reply_body: textBody,
                  replied_at: new Date().toISOString(),
                  read: true
                })
                .eq('id', composeContactId);
            }
            const newEmail: Email = {
              id: savedId ? `sent_${savedId}` : 'm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              _sentId: savedId ?? undefined,
              isSent: true,
              sender: `${customName} <${mailboxEmail}>`,
              senderEmail: mailboxEmail,
              recipient: targetEmail,
              cc: showCcField && composeCc ? composeCc : undefined,
              bcc: showBccField && composeBcc ? composeBcc : undefined,
              avatar: customAvatar,
              subject: composeSubject,
              snippet: textBody.substring(0, 100) + (textBody.length > 100 ? '...' : ''),
              body: htmlBody,
              date: 'Hoy',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              folder: 'sent',
              read: true,
              starred: false,
              important: false,
              labels: composeLabels,
              tracking: { status: 'delivered', clicks: [], downloads: [] },
            };
            newEmailsToAdd.push(newEmail);
          } else {
            errors.push(`${targetEmail}: ${result.error}`);
          }
        } catch (err: any) {
          errors.push(`${targetEmail}: ${err.message || err}`);
        }
      }
    } else {
      // ENVIAR CONJUNTO (UN SOLO CORREO A TODOS JUNTOS)
      try {
        // 1. Guardar en Supabase para obtener el ID (necesario para el pixel)
        const savedId = await saveSentEmail({
          from_email: mailboxEmail,
          from_name: customName,
          to_email: composeTo, // guardamos la cadena completa
          cc: showCcField && composeCc ? composeCc : undefined,
          bcc: showBccField && composeBcc ? composeBcc : undefined,
          subject: composeSubject,
          html_body: composeBody,
          text_body: textBody,
          labels: composeLabels,
        });

        // 2. Construir HTML con pixel de seguimiento y tracking de enlaces
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const trackedBody = savedId ? replaceLinksWithTracking(composeBody, savedId) : composeBody;
        const pixelUrl = savedId ? `${supabaseUrl}/functions/v1/track-open?id=${savedId}` : null;
        const trackingPixel = pixelUrl
          ? `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`
          : '';
        const htmlBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
</head>
<body style="margin:0;padding:0;background-color:transparent;">
  <div style="font-family:sans-serif;line-height:1.7;color:#1a1a2e;max-width:600px;">
    ${trackedBody}
    ${trackingPixel}
  </div>
</body>
</html>`;

        // 3. Enviar el correo
        const result = await sendEmail({
          to: composeTo, // enviamos a todos a la vez
          subject: composeSubject,
          html: htmlBody,
          from: `${customName} <${mailboxEmail}>`,
          cc: showCcField && composeCc ? composeCc : undefined,
          bcc: showBccField && composeBcc ? composeBcc : undefined
        });

        if (result.success) {
          successCount = 1;
          if (savedId) {
            await supabase
              .from('sent_emails')
              .update({ tracking_status: 'delivered' })
              .eq('id', savedId);
          }
          if (composeContactId) {
            await supabase
              .from('contact_messages')
              .update({
                replied: true,
                reply_body: textBody,
                replied_at: new Date().toISOString(),
                read: true
              })
              .eq('id', composeContactId);
          }
          const newEmail: Email = {
            id: savedId ? `sent_${savedId}` : 'm_' + Date.now(),
            _sentId: savedId ?? undefined,
            isSent: true,
            sender: `${customName} <${mailboxEmail}>`,
            senderEmail: mailboxEmail,
            recipient: composeTo,
            cc: showCcField && composeCc ? composeCc : undefined,
            bcc: showBccField && composeBcc ? composeBcc : undefined,
            avatar: customAvatar,
            subject: composeSubject,
            snippet: textBody.substring(0, 100) + (textBody.length > 100 ? '...' : ''),
            body: htmlBody,
            date: 'Hoy',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            folder: 'sent',
            read: true,
            starred: false,
            important: false,
            labels: composeLabels,
            tracking: { status: 'delivered', clicks: [], downloads: [] },
          };
          newEmailsToAdd.push(newEmail);
        } else {
          errors.push(result.error || 'Error desconocido');
        }
      } catch (err: any) {
        errors.push(err.message || err);
      }
    }

    setIsSendingCompose(false);

    if (newEmailsToAdd.length > 0) {
      setEmails(prev => [...newEmailsToAdd, ...prev]);
    }

    if (errors.length > 0) {
      showToast(`Error al enviar: ${errors.join('; ')}`, 'error');
    }

    if (successCount > 0) {
      showToast(
        successCount === 1 && !sendIndividually
          ? `Correo enviado correctamente a ${composeTo}`
          : successCount === 1
            ? `Correo enviado correctamente a ${newEmailsToAdd[0].recipient}`
            : `Se enviaron correctamente ${successCount} correos individuales.`,
        'success'
      );
      
      // Limpiar el formulario de redacción
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeCc('');
      setComposeBcc('');
      setShowCcField(false);
      setShowBccField(false);
      setComposeSubject('');
      setComposeBody('');
      setComposeLabels([]);
      setComposeTemplateId('none');
      setComposeContactId(null);
    }
  };

  // Lanzar Campaña de Mailing Masivo
  const handleLaunchCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName || !campaignSubject || !campaignBody) {
      showToast('Por favor, completa los campos requeridos.', 'error');
      return;
    }

    const targetUserCount = campaignTarget === 'all' ? 142 : campaignTarget === 'pro' ? 42 : 100;
    const isScheduled = !!campaignDate;

    const newCampaign: Campaign = {
      id: 'c_' + Date.now(),
      name: campaignName,
      subject: campaignSubject,
      target: campaignTarget === 'all' 
        ? 'Todos los empleados y mánagers' 
        : campaignTarget === 'pro' 
          ? 'Solo cuentas premium (Pro/Enterprise)' 
          : 'Cuentas gratuitas (Free/Basic)',
      sentDate: isScheduled ? formatDate(campaignDate) : formatDate(new Date()),
      sentCount: targetUserCount,
      openRate: isScheduled ? 0 : parseFloat((60 + Math.random() * 30).toFixed(1)),
      clickRate: isScheduled ? 0 : parseFloat((15 + Math.random() * 25).toFixed(1)),
      status: isScheduled ? 'scheduled' : 'sent',
      content: campaignBody
    };

    setCampaigns(prev => [newCampaign, ...prev]);
    setIsCreatingCampaign(false);
    
    // Limpiar formulario
    setCampaignName('');
    setCampaignSubject('');
    setCampaignBody('');
    setCampaignDate('');

    showToast(
      isScheduled 
        ? `📅 Campaña "${newCampaign.name}" programada correctamente.`
        : `🚀 Campaña "${newCampaign.name}" enviada con éxito a ${newCampaign.sentCount} destinatarios.`,
      'success'
    );
  };

  // Cargar una plantilla dentro de los editores
  const handleLoadTemplateToCampaign = (templateId: string) => {
    const selected = templates.find(t => t.id === templateId);
    if (selected) {
      // Reemplazamos algunas variables ficticias para que el usuario las visualice cargadas
      const mockContent = selected.content
        .replace(/{full_name}/g, 'Ana Martínez')
        .replace(/{company_name}/g, 'DemoCorp')
        .replace(/{activation_link}/g, 'http://localhost:3006/activate?token=928a3f8b');
        
      setCampaignSubject(selected.subject);
      setCampaignBody(mockContent);
      showToast(`Plantilla "${selected.name}" cargada en el editor de campaña.`, 'success');
    }
  };

  const handleLoadTemplateToComposer = (templateId: string) => {
    setComposeTemplateId(templateId);
    if (templateId === 'none' || !templateId) {
      setComposeSubject('');
      setComposeBody('');
      showToast('Campos de texto del redactor limpiados.', 'info');
      return;
    }

    const selected = templates.find(t => t.id === templateId);
    if (selected) {
      const mockContent = selected.content
        .replace(/{full_name}/g, 'Usuario Destinatario')
        .replace(/{company_name}/g, 'Su Empresa')
        .replace(/{activation_link}/g, 'https://fycheo.es/reset-password');
        
      setComposeSubject(selected.subject);
      setComposeBody(mockContent);
      showToast(`Plantilla "${selected.name}" cargada en el redactor.`, 'success');
    }
  };

  // Seleccionar plantilla para editar
  const handleSelectTemplateToEdit = (template: MailTemplate) => {
    setIsCreatingTemplate(false);
    setSelectedTemplate(template);
    setEditingTemplateName(template.name);
    setEditingTemplateSubject(template.subject);
    setEditingTemplateContent(template.content);
  };

  // Crear nueva plantilla
  const handleStartNewTemplate = () => {
    setIsCreatingTemplate(true);
    setSelectedTemplate(null);
    setEditingTemplateName('Nueva Plantilla Personalizada');
    setEditingTemplateSubject('Asunto del correo...');
    setEditingTemplateContent(`<html>
  <body style="font-family: sans-serif; padding: 20px;">
    <h2>Hola, {full_name}</h2>
    <p>Escribe aquí tu contenido HTML personalizado para {company_name}...</p>
  </body>
</html>`);
  };

  // Leer y convertir archivo de imagen de avatar a Base64
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecciona un archivo de imagen válido (PNG, JPG, etc.).', 'error');
        return;
      }
      if (file.size > 1024 * 1024) {
        showToast('La imagen es demasiado grande. Elige una de menos de 1 MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setTempAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Guardar configuración de personalización (nombre, avatar y color)
  const handleSavePersonalization = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...mailboxCustomizations,
      [settingsMailbox]: {
        displayName: tempDisplayName,
        avatar: tempAvatar,
        color: tempColor,
      }
    };
    setMailboxCustomizations(updated);
    localStorage.setItem('fycheo_mailbox_customizations', JSON.stringify(updated));
    showToast('Configuración de personalización guardada con éxito.', 'success');
  };

  // Guardar plantilla (Crear o Modificar)
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplateName || !editingTemplateSubject || !editingTemplateContent) {
      showToast('Por favor, rellena todos los campos de la plantilla.', 'error');
      return;
    }

    if (isCreatingTemplate) {
      // Crear nueva
      const newTemplate: MailTemplate = {
        id: 't_' + Date.now(),
        name: editingTemplateName,
        subject: editingTemplateSubject,
        content: editingTemplateContent
      };
      setTemplates(prev => [...prev, newTemplate]);
      setSelectedTemplate(newTemplate);
      setIsCreatingTemplate(false);
      showToast('Nueva plantilla guardada con éxito.', 'success');
    } else if (selectedTemplate) {
      // Modificar existente
      setTemplates(prev => prev.map(t => 
        t.id === selectedTemplate.id 
          ? { ...t, name: editingTemplateName, subject: editingTemplateSubject, content: editingTemplateContent }
          : t
      ));
      showToast('Plantilla actualizada con éxito.', 'success');
    }
  };

  // Borrar plantilla
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de que quieres eliminar esta plantilla de forma permanente?')) {
      const remaining = templates.filter(t => t.id !== id);
      setTemplates(remaining);
      if (selectedTemplate?.id === id || remaining.length === 0) {
        if (remaining.length > 0) {
          handleSelectTemplateToEdit(remaining[0]);
        } else {
          setSelectedTemplate(null);
          setEditingTemplateName('');
          setEditingTemplateSubject('');
          setEditingTemplateContent('');
        }
      }
      showToast('Plantilla eliminada.', 'success');
    }
  };

  // Filtrado de correos según buzón, carpeta, pestaña y búsqueda
  const filteredEmails = emails.filter(email => {
    let inMailbox: boolean;
    if (activeMailbox === 'all') {
      inMailbox = true; // vista unificada: todos los buzones
    } else {
      const isFirstMailbox = activeMailbox === MAILBOXES[0].email;
      const isSentByThisMailbox = email.senderEmail === activeMailbox;
      inMailbox = isFirstMailbox
        ? (!!email.isContact || (!!email.isInbound && (!email.toEmail || email.toEmail === activeMailbox)) || isSentByThisMailbox)
        : ((!!email.isInbound && email.toEmail === activeMailbox) || isSentByThisMailbox);
    }
    const inCurrentFolder = activeFolder === 'tracking'
      ? (email.folder === 'sent' && !!email.tracking)
      : (email.folder === activeFolder);
    const matchesLabels = selectedFilterLabels.length === 0 || 
      (email.labels && email.labels.some(lblId => selectedFilterLabels.includes(lblId)));
    const matchesSearch =
      email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.senderEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.snippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());

    return inMailbox && inCurrentFolder && matchesLabels && matchesSearch;
  });

  // Cálculos de tracking para KPIs dinámicos filtrados por buzón activo
  const trackingEmails = emails.filter(email => {
    let inMailbox: boolean;
    if (activeMailbox === 'all') {
      inMailbox = true;
    } else {
      const isFirstMailbox = activeMailbox === MAILBOXES[0].email;
      const isSentByThisMailbox = email.senderEmail === activeMailbox;
      inMailbox = isFirstMailbox
        ? (!!email.isContact || (!!email.isInbound && (!email.toEmail || email.toEmail === activeMailbox)) || isSentByThisMailbox)
        : ((!!email.isInbound && email.toEmail === activeMailbox) || isSentByThisMailbox);
    }
    return inMailbox && !!email.tracking;
  });
  const totalTracked = trackingEmails.length;
  const openedTracked = trackingEmails.filter(e => e.tracking?.status === 'opened').length;
  const openRate = totalTracked > 0 ? ((openedTracked / totalTracked) * 100).toFixed(1) : '0.0';
  
  const totalClicks = trackingEmails.reduce((acc, e) => {
    const clicksSum = e.tracking?.clicks?.reduce((sum, c) => sum + c.clicksCount, 0) ?? 0;
    return acc + clicksSum;
  }, 0);

  const totalDownloads = trackingEmails.reduce((acc, e) => {
    const downloadsSum = e.tracking?.downloads?.reduce((sum, d) => sum + d.downloadsCount, 0) ?? 0;
    return acc + downloadsSum;
  }, 0);

  return (
    <>
    {!onlyCompose && (
      <div className={`gmail-interface animate-fade-in${activeFolder === 'settings' ? ' settings-mode' : ''}`}>
      {/* HEADER TIPO GMAIL */}
      {!selectedEmail && <div className="gmail-header glass-card">
        <div className="search-box-wrap">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Buscar en el correo maestro..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="gmail-search-input"
          />
          <div className="filter-icon" title="Opciones de búsqueda">
            <Filter size={16} />
          </div>
        </div>
        
        <div className="header-actions">
          <div className="sync-widget">
            {/* BOTÓN PRINCIPAL CON ESTADO + COUNTDOWN */}
            <button
              onClick={loadContactMessages}
              className={`sync-main-btn sync-btn-state ${contactSyncStatus}`}
              title="Sincronizar mensajes de contacto desde Supabase"
              disabled={isLoadingContacts}
            >
              {/* Icono + texto */}
              <span className="sync-btn-left">
                <RefreshCw size={13} className={isLoadingContacts ? 'sync-icon spinning' : 'sync-icon'} />
                <span className="sync-btn-label">
                  {isLoadingContacts ? 'Sincronizando...' : 'Sincronizar'}
                </span>
              </span>

              {/* Badge de estado / countdown */}
              <span className={`sync-countdown-inline status-${contactSyncStatus}`}>
                {contactSyncStatus === 'ok' && !isLoadingContacts ? formatCountdown(nextSyncIn) : null}
                {contactSyncStatus === 'loading' || isLoadingContacts ? '···' : null}
                {contactSyncStatus === 'error' ? '✕' : null}
                {contactSyncStatus === 'idle' ? '—' : null}
              </span>
            </button>

            {/* FECHA ÚLTIMA SYNC — muy pequeña debajo del botón */}
            <div className="sync-last-update">
              {contactSyncStatus === 'loading' && 'Actualizando...'}
              {contactSyncStatus === 'error' && 'Sin conexión con Supabase'}
              {contactSyncStatus === 'idle' && 'Iniciando...'}
              {contactSyncStatus === 'ok' && lastSyncTime && (
                <>Actualizado: {formatLastSync(lastSyncTime)}</>
              )}
            </div>
          </div>
        </div>

      </div>}

      {/* SECCIÓN ESTADO DE BANDEJA Y REDACTAR */}
      {!selectedEmail && <div className="mailbox-title-bar glass-card" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'rgba(14, 18, 29, 0.4)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        marginTop: '-4px',
        marginBottom: '4px',
        position: 'relative',
        zIndex: 50
      }}>
        {/* Lado izquierdo: Ubicación de bandeja actual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Círculo indicador de color del buzón */}
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: activeMailbox === 'all' 
              ? '#6366f1' 
              : (mailboxCustomizations[activeMailbox]?.color || MAILBOXES.find(m => m.email === activeMailbox)?.color || '#8b5cf6')
          }} />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              {activeMailbox === 'all' 
                ? 'Todas las bandejas' 
                : (mailboxCustomizations[activeMailbox]?.displayName || MAILBOXES.find(m => m.email === activeMailbox)?.displayName || activeMailbox)
              }
            </span>
            <span style={{ color: 'var(--text-darker)', fontWeight: 400 }}>/</span>
            <span style={{ color: 'var(--primary-light)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {activeFolder === 'inbox' && <><Inbox size={15} /> Recibidos</>}
              {activeFolder === 'sent' && <><Send size={15} /> Enviados</>}
              {activeFolder === 'drafts' && <><FileText size={15} /> Borradores</>}
              {activeFolder === 'trash' && <><Trash2 size={15} /> Papelera</>}
              {activeFolder === 'settings' && <><Settings2 size={15} /> Configuración</>}
              {activeFolder === 'campaigns' && <><Megaphone size={15} /> Campañas</>}
              {activeFolder === 'tracking' && <><CheckCheck size={15} /> Seguimiento</>}
            </span>
          </h2>
        </div>

        {/* Lado derecho: selector de buzón en settings */}
        {activeFolder === 'settings' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bandeja:</span>
            <div style={{ width: '240px' }}>
              <CustomSelect
                value={settingsMailbox}
                onChange={setSettingsMailbox}
                options={filteredMailboxes.map(m => {
                  const displayName = mailboxCustomizations[m.email]?.displayName || m.displayName;
                  const avatarVal = mailboxCustomizations[m.email]?.avatar || m.label.slice(0, 2).toUpperCase();
                  const colorVal = mailboxCustomizations[m.email]?.color || m.color;
                  return {
                    value: m.email,
                    label: `${displayName} (${m.email})`,
                    icon: (
                      <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: isImageAvatar(avatarVal) ? 'transparent' : colorVal, color: 'white', fontSize: '0.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {isImageAvatar(avatarVal) ? <img src={avatarVal} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : avatarVal}
                      </div>
                    )
                  };
                })}
              />
            </div>
          </div>
        )}

        {/* Lado derecho: Filtro de Etiquetas y Botón Redactar */}
        {activeFolder !== 'settings' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Selector de Etiquetas */}
            <div ref={filterDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                className="btn btn-outline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                }}
              >
                <Tag size={13} className={selectedFilterLabels.length > 0 ? "text-primary-light" : ""} />
                <span>
                  {selectedFilterLabels.length === 0 
                    ? 'Etiquetas' 
                    : `Etiquetas (${selectedFilterLabels.length})`
                  }
                </span>
                <ChevronDown size={12} style={{ transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
              </button>

              {isFilterDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  zIndex: 999,
                  background: 'rgba(19, 24, 38, 0.95)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '12px',
                  width: '240px',
                  boxShadow: 'var(--shadow-glow)',
                  backdropFilter: 'blur(16px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)' }}>Filtrar por Etiqueta</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Botón Lápiz para Modo Edición */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingLabelsMode(prev => !prev);
                          setEditingLabelColorId(null);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isEditingLabelsMode ? 'var(--primary-light)' : 'var(--text-darker)',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'color 0.2s'
                        }}
                        title="Editar etiquetas"
                      >
                        <Pencil size={12} style={{ color: isEditingLabelsMode ? 'var(--primary-light)' : 'var(--text-darker)' }} />
                      </button>

                      {selectedFilterLabels.length > 0 && !isEditingLabelsMode && (
                        <button
                          type="button"
                          onClick={() => setSelectedFilterLabels([])}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary-light)',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Listado de etiquetas disponibles para el buzón activo */}
                  <div style={{
                    maxHeight: '150px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {(mailboxLabels[activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox] || []).map(lbl => {
                      const isChecked = selectedFilterLabels.includes(lbl.id);
                      const isEditingColor = editingLabelColorId === lbl.id;
                      return (
                        <div 
                          key={lbl.id} 
                          style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            background: isChecked && !isEditingLabelsMode ? `${lbl.color}15` : 'transparent',
                            borderRadius: '8px',
                            padding: '2px 4px',
                            transition: 'all 0.2s ease',
                            border: isChecked && !isEditingLabelsMode ? `1px solid ${lbl.color}` : '1px solid rgba(255, 255, 255, 0.05)',
                            margin: '2px 0'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            {isEditingLabelsMode ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-light)',
                                  flex: 1,
                                  overflow: 'hidden'
                                }}
                              >
                                <Tag size={12} style={{ color: lbl.color, flexShrink: 0 }} />
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{lbl.name}</span>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setSelectedFilterLabels(prev => 
                                    prev.includes(lbl.id)
                                      ? prev.filter(id => id !== lbl.id)
                                      : [...prev, lbl.id]
                                  );
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  color: isChecked ? 'white' : 'var(--text-darker)',
                                  flex: 1,
                                  overflow: 'hidden',
                                  userSelect: 'none'
                                }}
                              >
                                <Tag size={12} style={{ color: lbl.color, flexShrink: 0 }} />
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: isChecked ? 600 : 400 }}>{lbl.name}</span>
                              </div>
                            )}

                            {/* Acciones de Edición/Borrado (solo visibles en Modo Edición) */}
                            {isEditingLabelsMode && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '4px' }}>
                                {/* Botón cambiar color */}
                                <button
                                  type="button"
                                  title="Cambiar color"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingLabelColorId(isEditingColor ? null : lbl.id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-darker)'
                                  }}
                                >
                                  <span style={{
                                    width: '10px',
                                    height: '10px',
                                    borderRadius: '50%',
                                    background: lbl.color,
                                    border: '1px solid rgba(255,255,255,0.2)'
                                  }} />
                                </button>

                                {/* Botón borrar */}
                                <button
                                  type="button"
                                  title="Eliminar etiqueta"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (confirm(`¿Estás seguro de que quieres eliminar la etiqueta "${lbl.name}"?`)) {
                                      handleDeleteLabel(lbl.id);
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-darker)',
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-darker)'}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Selector de color inline expandido */}
                          {isEditingColor && (
                            <div style={{
                              display: 'flex',
                              gap: '6px',
                              padding: '6px 8px 4px 8px',
                              borderTop: '1px solid rgba(255,255,255,0.05)',
                              marginTop: '2px',
                              justifyContent: 'center'
                            }}>
                              {[
                                '#ef4444', // Rojo
                                '#3b82f6', // Azul
                                '#10b981', // Verde
                                '#f59e0b', // Amarillo/Naranja
                                '#8b5cf6', // Morado
                                '#ec4899', // Rosa
                                '#06b6d4', // Cyan
                                '#6b7280'  // Gris
                              ].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateLabelColor(lbl.id, color);
                                    setEditingLabelColorId(null);
                                  }}
                                  style={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    background: color,
                                    border: lbl.color === color ? '1px solid white' : 'none',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                />
                              ))}

                              {/* Selector de color libre arcoíris */}
                              <div style={{
                                position: 'relative',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: !['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'].includes(lbl.color) ? '1px solid white' : 'none',
                                flexShrink: 0
                              }}>
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
                                }} />
                                <input 
                                  type="color" 
                                  value={lbl.color}
                                  onChange={(e) => {
                                    handleUpdateLabelColor(lbl.id, e.target.value);
                                  }}
                                  onBlur={() => setEditingLabelColorId(null)}
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0,
                                    cursor: 'pointer',
                                    border: 'none',
                                    padding: 0
                                  }}
                                  title="Color personalizado"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {(mailboxLabels[activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox] || []).length === 0 && (
                      <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-darker)' }}>
                        No hay etiquetas en esta bandeja.
                      </div>
                    )}
                  </div>

                  {/* Botón para crear nueva etiqueta */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterDropdownOpen(false);
                      setIsNewLabelModalOpen(true);
                    }}
                    style={{
                      marginTop: '4px',
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
                      border: '1px dashed rgba(139, 92, 246, 0.3)',
                      color: 'var(--primary-light)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Plus size={12} />
                    <span>Crear nueva etiqueta</span>
                  </button>
                </div>
              )}
            </div>

            {/* Botón Redactar */}
            <button 
              type="button" 
              onClick={() => {
                setComposeLabels([]); // Limpiar etiquetas al redactar nuevo correo
                setIsComposeOpen(true);
              }}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.8rem',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                border: 'none',
                boxShadow: 'var(--shadow-glow)',
                cursor: 'pointer'
              }}
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>Redactar Correo</span>
            </button>
          </div>
        )}
      </div>}

      <div className={`gmail-body-layout${activeFolder === 'settings' ? ' settings-mode' : ''}`}>
        {/* CONTENEDOR CENTRAL */}
        <div className={`gmail-content-area${selectedEmail ? ' email-open' : activeFolder === 'settings' ? ' settings-mode glass-card' : ' glass-card'}`}>
          
          {/* SECCIÓN CAMPAÑAS DE MAILING */}
          {activeFolder === 'campaigns' ? (
            isCreatingCampaign ? (
              /* ASISTENTE DE CREACIÓN DE CAMPAÑA */
              <div className="campaign-wizard-view">
                <div className="detail-toolbar">
                  <button onClick={() => setIsCreatingCampaign(false)} className="btn-back-list">
                    <X size={16} />
                    <span>Volver a Campañas</span>
                  </button>
                  <h3>Diseñar Campaña de Mailing Masivo</h3>
                </div>

                <div className="campaign-wizard-layout">
                  {/* Formulario */}
                  <form onSubmit={handleLaunchCampaign} className="campaign-wizard-form">
                    <div className="input-group">
                      <label className="input-label">Cargar plantilla guardada</label>
                      <CustomSelect
                        value=""
                        onChange={handleLoadTemplateToCampaign}
                        options={templates.map(t => ({
                          value: t.id,
                          label: t.name
                        }))}
                        placeholder="-- Selecciona una plantilla para cargar --"
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Nombre de Campaña (Interno)</label>
                      <input 
                        type="text" 
                        placeholder="Ej. Campaña Novedades Verano 2026"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-row-grid">
                      <div className="input-group">
                        <label className="input-label">Segmento Destinatario</label>
                        <select 
                          value={campaignTarget}
                          onChange={(e) => setCampaignTarget(e.target.value)}
                          className="form-input form-select"
                        >
                          <option value="all">Todas las cuentas registradas (142 destinatarios)</option>
                          <option value="pro">Solo clientes de pago Pro/Enterprise (42 destinatarios)</option>
                          <option value="free">Solo clientes plan gratuito Free/Basic (100 destinatarios)</option>
                        </select>
                      </div>

                      <div className="input-group">
                        <label className="input-label">Programar envío (Opcional)</label>
                        <div className="date-input-wrap">
                          <Calendar size={14} className="date-icon" />
                          <input 
                            type="datetime-local" 
                            value={campaignDate}
                            onChange={(e) => setCampaignDate(e.target.value)}
                            className="form-input date-input"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="input-group">
                      <label className="input-label">Asunto del Correo</label>
                      <input 
                        type="text" 
                        placeholder="Asunto llamativo que verán los destinatarios..."
                        value={campaignSubject}
                        onChange={(e) => setCampaignSubject(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Contenido HTML / Mensaje</label>
                      <textarea 
                        rows={12} 
                        placeholder="Escribe el boletín o aviso. Puedes usar código HTML y estilos en línea..."
                        value={campaignBody}
                        onChange={(e) => setCampaignBody(e.target.value)}
                        className="form-input form-textarea font-mono"
                        required
                      />
                    </div>

                    <div className="form-submit-row">
                      <button type="submit" className="btn btn-primary">
                        <Send size={14} />
                        <span>{campaignDate ? 'Programar Difusión' : 'Lanzar Campaña Ahora'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Vista Previa en Vivo (WOW Effect) */}
                  <div className="campaign-wizard-preview">
                    <div className="preview-header-bar">
                      <span>Vista Previa del Destinatario</span>
                      <div className="preview-toggle-btns">
                        <button 
                          onClick={() => setPreviewMode('desktop')}
                          className={`preview-toggle-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                        >
                          <Monitor size={14} />
                        </button>
                        <button 
                          onClick={() => setPreviewMode('mobile')}
                          className={`preview-toggle-btn ${previewMode === 'mobile' ? 'active' : ''}`}
                        >
                          <Smartphone size={14} />
                        </button>
                      </div>
                    </div>

                    <div className={`preview-viewport-wrap ${previewMode}`}>
                      <div className="preview-viewport-content">
                        <div className="preview-email-header">
                          <p><strong>De:</strong> Fycheo Central &lt;avisos@fycheo.co&gt;</p>
                          <p><strong>Para:</strong> cliente@fycheo-empresa.es</p>
                          <p><strong>Asunto:</strong> {campaignSubject || '(Sin Asunto)'}</p>
                        </div>
                        <div className="preview-email-body">
                          {campaignBody ? (
                            <div dangerouslySetInnerHTML={{ __html: campaignBody }} />
                          ) : (
                            <p className="placeholder-text-preview">El contenido del correo se renderizará aquí en tiempo real a medida que escribas...</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* LISTADO DE CAMPAÑAS Y METRICAS */
              <div className="campaigns-dashboard-view">
                <div className="campaign-kpis-header">
                  <div>
                    <h3>Campañas de Mailing y Avisos</h3>
                    <p className="text-muted text-xs">Crea difusiones masivas para tu base de datos de usuarios y monitoriza su impacto.</p>
                  </div>
                  <button onClick={() => setIsCreatingCampaign(true)} className="btn btn-primary">
                    <Megaphone size={16} />
                    <span>Nueva Campaña</span>
                  </button>
                </div>

                <div className="campaigns-kpi-grid">
                  <div className="kpi-card-mini">
                    <Users size={16} className="text-primary-light" />
                    <div>
                      <p className="kpi-val">296</p>
                      <p className="kpi-lbl">Total Envíos</p>
                    </div>
                  </div>
                  <div className="kpi-card-mini">
                    <Percent size={16} className="text-success-light" />
                    <div>
                      <p className="kpi-val">78.5%</p>
                      <p className="kpi-lbl">Apertura Media</p>
                    </div>
                  </div>
                  <div className="kpi-card-mini">
                    <BarChart2 size={16} className="text-secondary-light" />
                    <div>
                      <p className="kpi-val">29.5%</p>
                      <p className="kpi-lbl">Tasa media CTR</p>
                    </div>
                  </div>
                </div>

                {/* Tabla de Campañas */}
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Campaña / Asunto</th>
                        <th>Destinatarios</th>
                        <th>Fecha</th>
                        <th>Enviados</th>
                        <th>Apertura (%)</th>
                        <th>Clics (%)</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((camp) => (
                        <tr key={camp.id}>
                          <td>
                            <div className="campaign-name-cell">
                              <span className="camp-name-title">{camp.name}</span>
                              <span className="camp-subject-sub text-muted">{camp.subject}</span>
                            </div>
                          </td>
                          <td>
                            <span className="tag-target-badge">{camp.target}</span>
                          </td>
                          <td>{camp.sentDate}</td>
                          <td className="font-mono">{camp.sentCount}</td>
                          <td>
                            {camp.status === 'scheduled' ? '-' : (
                              <div className="progress-bar-wrap">
                                <span className="val">{camp.openRate}%</span>
                                <div className="progress-bar-bg"><div className="progress-bar-fill success" style={{ width: `${camp.openRate}%` }} /></div>
                              </div>
                            )}
                          </td>
                          <td>
                            {camp.status === 'scheduled' ? '-' : (
                              <div className="progress-bar-wrap">
                                <span className="val">{camp.clickRate}%</span>
                                <div className="progress-bar-bg"><div className="progress-bar-fill info" style={{ width: `${camp.clickRate}%` }} /></div>
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${
                              camp.status === 'sent' ? 'badge-success' : 
                              camp.status === 'scheduled' ? 'badge-warning' : 'badge-secondary'
                            }`}>
                              {camp.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : activeFolder === 'settings' ? (
            /* SECCIÓN CONFIGURACIÓN DE BANDEJA */
            <div className="settings-dashboard-view" style={{ padding: '24px' }}>
              {/* Header con título */}
              <div className="campaign-kpis-header" style={{ marginBottom: '16px' }}>
                <div>
                  <h3>Configuración de Bandeja</h3>
                  <p className="text-muted text-xs">Personaliza la presentación, gestiona las plantillas de correo y edita las firmas de tus buzones.</p>
                </div>
              </div>

              {/* Tabs de Configuración */}
              <div className="settings-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => setSettingsTab('personalization')}
                  className={`category-tab ${settingsTab === 'personalization' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: settingsTab === 'personalization' ? 'rgba(139,92,246,0.12)' : 'transparent', border: 'none', color: settingsTab === 'personalization' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <User size={15} />
                  <span>Personalización</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('templates')}
                  className={`category-tab ${settingsTab === 'templates' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: settingsTab === 'templates' ? 'rgba(139,92,246,0.12)' : 'transparent', border: 'none', color: settingsTab === 'templates' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <Layers size={15} />
                  <span>Plantillas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('signatures')}
                  className={`category-tab ${settingsTab === 'signatures' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: settingsTab === 'signatures' ? 'rgba(139,92,246,0.12)' : 'transparent', border: 'none', color: settingsTab === 'signatures' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <FileText size={15} />
                  <span>Firmas HTML</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsTab('inbox')}
                  className={`category-tab ${settingsTab === 'inbox' ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: settingsTab === 'inbox' ? 'rgba(139,92,246,0.12)' : 'transparent', border: 'none', color: settingsTab === 'inbox' ? 'var(--primary-light)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  <Inbox size={15} />
                  <span>Bandeja</span>
                </button>
              </div>

              {/* Contenido de la pestaña activa */}
              <div className="settings-tab-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                
                {/* 1. PERSONALIZACIÓN */}
                {settingsTab === 'personalization' && (
                  <div className="settings-personalization-view" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                    <form onSubmit={handleSavePersonalization} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="input-group">
                        <label className="input-label">Nombre para Mostrar</label>
                        <input
                          type="text"
                          value={tempDisplayName}
                          onChange={(e) => setTempDisplayName(e.target.value)}
                          className="form-input"
                          placeholder="Ej. Fycheo Soporte"
                          required
                        />
                      </div>
                      <div className="input-group">
                        <label className="input-label">Avatar (Iniciales, Emoji o URL)</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={tempAvatar}
                            onChange={(e) => setTempAvatar(e.target.value)}
                            className="form-input"
                            style={{ flex: 1 }}
                            placeholder="Ej. FS, ✉️, o URL de imagen"
                            required
                          />
                          <label 
                            className="btn" 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '6px', 
                              padding: '8px 14px', 
                              borderRadius: '8px', 
                              border: '1px dashed var(--border-color)', 
                              background: 'rgba(255,255,255,0.02)', 
                              color: 'var(--text-muted)', 
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <ImageIcon size={14} />
                            <span>Subir Imagen</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={handleAvatarFileChange} 
                              style={{ display: 'none' }} 
                            />
                          </label>
                        </div>
                        <p className="text-muted text-xs" style={{ marginTop: '4px' }}>
                          Escribe iniciales, pega una URL de imagen o haz clic en "Subir Imagen" para cargar una foto local (máx. 1MB).
                        </p>
                      </div>
                      <div className="input-group">
                        <label className="input-label">Color de la Bandeja</label>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <input
                            type="color"
                            value={tempColor}
                            onChange={(e) => setTempColor(e.target.value)}
                            style={{ width: '46px', height: '38px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }}
                          />
                          <input
                            type="text"
                            value={tempColor.toUpperCase()}
                            onChange={(e) => setTempColor(e.target.value)}
                            className="form-input"
                            style={{ flex: 1, textTransform: 'uppercase' }}
                            placeholder="#FFFFFF"
                            pattern="^#[0-9A-Fa-f]{6}$"
                            required
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary">
                          <Save size={14} />
                          <span>Guardar Personalización</span>
                        </button>
                      </div>
                    </form>

                    {/* Previsualización en Vivo de la Bandeja */}
                    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <span className="hints-header-title" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vista Previa en el Ecosistema</span>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-darker)', marginBottom: '4px' }}>Así se verá en la cabecera de correos y barra lateral:</p>
                        
                        {/* Cabecera remitente */}
                        <div className="detail-sender-row" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div className="mailbox-dot" style={{ background: tempColor, width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 }} />
                          <div className="sender-avatar" style={{ margin: 0, flexShrink: 0 }}>
                            {isImageAvatar(tempAvatar) ? (
                              <img src={tempAvatar} alt={tempDisplayName} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%', display: 'block' }} />
                            ) : (
                              tempAvatar || 'FM'
                            )}
                          </div>
                          <div className="sender-details">
                            <div className="sender-meta">
                              <span className="sender-full-name">{tempDisplayName || 'Nombre'}</span>
                              <span className="sender-email">&lt;{settingsMailbox}&gt;</span>
                            </div>
                            <span className="recipient-meta" style={{ fontSize: '0.7rem' }}>
                              para <strong>{settingsMailbox}</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PLANTILLAS */}
                {settingsTab === 'templates' && (
                  <div className="templates-layout" style={{ height: 'calc(100% - 20px)' }}>
                    {/* Lista Lateral de Plantillas */}
                    <div className="templates-list-sidebar">
                      <span className="sidebar-sub-title">Plantillas Guardadas</span>
                      <div className="templates-items-wrapper">
                        {templates.map(t => (
                          <div 
                            key={t.id} 
                            onClick={() => handleSelectTemplateToEdit(t)}
                            className={`template-item-row ${selectedTemplate?.id === t.id && !isCreatingTemplate ? 'active' : ''}`}
                          >
                            <div className="template-item-meta-info">
                              <FileText size={14} className="item-icon" />
                              <span className="template-name-label">{t.name}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => handleDeleteTemplate(t.id, e)}
                              className="template-delete-btn"
                              title="Eliminar plantilla"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                      
                      <div className="variable-hints-box">
                        <span className="hints-header-title">Etiquetas dinámicas</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                          {([
                            { key: 'empleado', label: 'Empleado', tags: [
                              ['{full_name}', 'Nombre completo'],
                              ['{first_name}', 'Nombre'],
                              ['{last_name}', 'Apellidos'],
                              ['{email}', 'Correo electrónico'],
                              ['{role}', 'Cargo / Rol'],
                            ]},
                            { key: 'empresa', label: 'Empresa', tags: [
                              ['{company_name}', 'Nombre de empresa'],
                              ['{company_id}', 'ID de empresa'],
                            ]},
                            { key: 'fechas', label: 'Fechas', tags: [
                              ['{date}', 'Fecha actual'],
                              ['{time}', 'Hora actual'],
                            ]},
                            { key: 'fichaje', label: 'Fichaje', tags: [
                              ['{check_in_time}', 'Hora de entrada'],
                              ['{check_out_time}', 'Hora de salida'],
                              ['{work_hours}', 'Horas trabajadas'],
                            ]},
                            { key: 'enlaces', label: 'Enlaces', tags: [
                              ['{activation_link}', 'Activación de cuenta'],
                              ['{reset_link}', 'Restablecer contraseña'],
                              ['{login_link}', 'Acceso a la plataforma'],
                            ]},
                          ] as { key: string; label: string; tags: [string, string][] }[]).map(group => {
                            const isOpen = openTagGroups.includes(group.key);
                            return (
                              <div key={group.key}>
                                <button
                                  type="button"
                                  onClick={() => toggleTagGroup(group.key)}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                >
                                  <span>{group.label}</span>
                                  <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                </button>
                                {isOpen && (
                                  <ul className="hints-variables" style={{ margin: '2px 0 4px', paddingLeft: '4px' }}>
                                    {group.tags.map(([tag, desc]) => (
                                      <li key={tag}><code>{tag}</code>: {desc}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Editor y Previsualizador de la Plantilla */}
                    <div className="template-editor-workspace">
                      <form onSubmit={handleSaveTemplate} className="template-editor-inner-form">
                        <div className="input-group">
                          <label className="input-label">Nombre de la Plantilla</label>
                          <input 
                            type="text" 
                            value={editingTemplateName} 
                            onChange={(e) => setEditingTemplateName(e.target.value)}
                            className="form-input"
                            placeholder="Ej. Notificación de Fichaje Olvidado"
                            required
                          />
                        </div>

                        <div className="input-group">
                          <label className="input-label">Asunto por Defecto</label>
                          <input 
                            type="text" 
                            value={editingTemplateSubject} 
                            onChange={(e) => setEditingTemplateSubject(e.target.value)}
                            className="form-input"
                            placeholder="Asunto predeterminado del correo..."
                            required
                          />
                        </div>

                        <div className="input-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                          <label className="input-label">Estructura HTML de Cuerpo</label>
                          <textarea 
                            rows={10} 
                            value={editingTemplateContent} 
                            onChange={(e) => setEditingTemplateContent(e.target.value)}
                            className="form-input form-textarea font-mono"
                            placeholder="Código HTML..."
                            style={{ flex: 1, minHeight: '220px' }}
                            required
                          />
                        </div>

                        <div className="editor-actions-row" style={{ display: 'flex', gap: '8px' }}>
                          <button type="submit" className="btn btn-primary">
                            <Save size={14} />
                            <span>{isCreatingTemplate ? 'Crear Plantilla' : 'Guardar Cambios'}</span>
                          </button>
                          {!isCreatingTemplate && (
                            <button type="button" onClick={handleStartNewTemplate} className="btn btn-secondary">
                              <Plus size={14} />
                              <span>Nueva Plantilla</span>
                            </button>
                          )}
                        </div>
                      </form>

                      {/* Panel de Previsualización en Vivo de la Plantilla */}
                      <div className="template-live-preview">
                        <div className="preview-header-bar">
                          <span>Vista Previa (Mánager / Empleado)</span>
                          <div className="preview-toggle-btns">
                            <button 
                              type="button"
                              onClick={() => setTemplatePreviewMode('desktop')}
                              className={`preview-toggle-btn ${templatePreviewMode === 'desktop' ? 'active' : ''}`}
                            >
                              <Monitor size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setTemplatePreviewMode('mobile')}
                              className={`preview-toggle-btn ${templatePreviewMode === 'mobile' ? 'active' : ''}`}
                            >
                              <Smartphone size={14} />
                            </button>
                          </div>
                        </div>

                        <div className={`preview-viewport-wrap ${templatePreviewMode}`} style={{ height: '100%' }}>
                          <div className="preview-viewport-content">
                            <div className="preview-email-header">
                              <p><strong>De:</strong> Fycheo &lt;notificaciones@fycheo.co&gt;</p>
                              <p><strong>Para:</strong> destinatario@ejemplo.es</p>
                              <p><strong>Asunto:</strong> {getRenderedTemplatePreview(editingTemplateSubject) || '(Sin Asunto)'}</p>
                            </div>
                            <div className="preview-email-body" style={{ padding: 0, overflow: 'visible' }}>
                              {editingTemplateContent ? (
                                <iframe
                                  key={getRenderedTemplatePreview(editingTemplateContent)}
                                  srcDoc={getRenderedTemplatePreview(editingTemplateContent)}
                                  sandbox="allow-same-origin"
                                  style={{ width: '100%', border: 'none', display: 'block', height: '0' }}
                                  onLoad={e => {
                                    const iframe = e.currentTarget;
                                    try {
                                      const h = iframe.contentDocument?.documentElement?.scrollHeight;
                                      if (h && h > 50) iframe.style.height = h + 'px';
                                    } catch { }
                                  }}
                                />
                              ) : (
                                <p className="placeholder-text-preview" style={{ padding: '12px' }}>Escribe código HTML en el editor de la izquierda para ver el renderizado...</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. FIRMAS */}
                {settingsTab === 'signatures' && (
                  <div className="settings-signatures-view glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p className="sig-editor-hint" style={{ marginBottom: '8px' }}>Edita la firma HTML para el buzón <strong>{settingsMailbox}</strong>.</p>

                    <div className="sig-editor-split" style={{ minHeight: '340px' }}>
                      <div className="sig-editor-pane">
                        <span className="pane-label">Código HTML</span>
                        <textarea
                          className="sig-textarea font-mono"
                          placeholder={`<p>Saludos,</p>\n<strong>Ronald Herrera</strong><br/>\n<a href="https://fycheo.es">Fycheo</a>`}
                          value={sigDraft[settingsMailbox] ?? ''}
                          onChange={e => setSigDraft(prev => ({ ...prev, [settingsMailbox]: e.target.value }))}
                          rows={12}
                          style={{ fontFamily: 'monospace' }}
                        />
                      </div>
                      <div className="sig-preview-pane">
                        <span className="pane-label">Vista Previa</span>
                        <div className="sig-preview-content" style={{ padding: 0, overflow: 'visible', minHeight: '260px' }}>
                          {sigDraft[settingsMailbox] ? (
                            <iframe
                              key={sigDraft[settingsMailbox]}
                              srcDoc={sigDraft[settingsMailbox]}
                              sandbox="allow-same-origin"
                              style={{ width: '100%', border: 'none', display: 'block', height: '0' }}
                              onLoad={e => {
                                const iframe = e.currentTarget;
                                try {
                                  const h = iframe.contentDocument?.documentElement?.scrollHeight;
                                  if (h && h > 50) iframe.style.height = h + 'px';
                                } catch { }
                              }}
                            />
                          ) : (
                            <span className="placeholder-text-preview">Sin firma (Texto vacío)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="sig-editor-actions" style={{ marginTop: '16px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSigDraft(prev => ({ ...prev, [settingsMailbox]: '' }))}
                      >
                        Borrar firma
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          saveSignatures(sigDraft);
                          setMailboxSignatures({ ...sigDraft });
                          showToast('Firmas guardadas con éxito.', 'success');
                        }}
                      >
                        Guardar Firma
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. BANDEJA */}
                {settingsTab === 'inbox' && (() => {
                  const defaultSettings: MailboxSettings = {
                    email: settingsMailbox,
                    inbox_enabled: true,
                    auto_delete: false,
                    auto_reply_enabled: false,
                    auto_reply_subject: `Re: {{subject}}`,
                    auto_reply_body: `<p>Gracias por contactar con nosotros. Este buzón no está monitorizado.</p><p>Para cualquier consulta, escríbenos a <a href="mailto:hola@fycheo.es">hola@fycheo.es</a>.</p>`,
                  };
                  // Draft local: edits en memoria hasta que el usuario guarde
                  const currentSettings: MailboxSettings =
                    inboxSettingsDraft[settingsMailbox] ??
                    mailboxSettingsMap[settingsMailbox] ??
                    defaultSettings;
                  const update = (patch: Partial<MailboxSettings>) => {
                    setInboxSettingsDraft(prev => ({
                      ...prev,
                      [settingsMailbox]: { ...currentSettings, ...patch },
                    }));
                  };
                  const handleSaveInboxSettings = async () => {
                    setSavingInboxSettings(true);
                    const toSave = { ...currentSettings, email: settingsMailbox };
                    await saveMailboxSettings(toSave);
                    // Solo al guardar se actualiza el mapa compartido (y por tanto el Sidebar)
                    setMailboxSettingsMap(prev => ({ ...prev, [settingsMailbox]: toSave }));
                    // Limpiar el draft de este buzón
                    setInboxSettingsDraft(prev => { const n = { ...prev }; delete n[settingsMailbox]; return n; });
                    setSavingInboxSettings(false);
                    showToast('Configuración de bandeja guardada.', 'success');
                  };
                  return (
                    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
                        Configuración de recepción para <strong style={{ color: 'var(--text-primary)' }}>{settingsMailbox}</strong>.
                      </p>

                      {/* Inbox enabled toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Inbox size={18} style={{ color: currentSettings.inbox_enabled ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Bandeja de entrada activa</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Recibir y almacenar correos entrantes en este buzón.</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => update({ inbox_enabled: !currentSettings.inbox_enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentSettings.inbox_enabled ? 'var(--primary-light)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{currentSettings.inbox_enabled ? 'Sí' : 'No'}</span>
                          {currentSettings.inbox_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                      </div>

                      {/* Auto-delete toggle — solo visible si inbox está desactivado */}
                      {!currentSettings.inbox_enabled && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Trash size={18} style={{ color: currentSettings.auto_delete ? '#ef4444' : 'var(--text-muted)' }} />
                            <div>
                              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Eliminar automáticamente</p>
                              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Borrar los correos recibidos en este buzón sin guardarlos.</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => update({ auto_delete: !currentSettings.auto_delete })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentSettings.auto_delete ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{currentSettings.auto_delete ? 'Sí' : 'No'}</span>
                            {currentSettings.auto_delete ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          </button>
                        </div>
                      )}

                      {/* Auto-reply toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <MessageSquareOff size={18} style={{ color: currentSettings.auto_reply_enabled ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0 }}>Respuesta automática</p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Enviar un mensaje automático a quien escriba a este buzón.</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => update({ auto_reply_enabled: !currentSettings.auto_reply_enabled })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentSettings.auto_reply_enabled ? 'var(--primary-light)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{currentSettings.auto_reply_enabled ? 'Sí' : 'No'}</span>
                          {currentSettings.auto_reply_enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                      </div>

                      {/* Auto-reply config — visible si auto_reply_enabled */}
                      {currentSettings.auto_reply_enabled && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                          <div className="input-group">
                            <label className="input-label">Asunto del auto-reply</label>
                            <input
                              type="text"
                              className="form-input"
                              value={currentSettings.auto_reply_subject}
                              onChange={e => update({ auto_reply_subject: e.target.value })}
                              placeholder="Re: {{subject}}"
                            />
                          </div>
                          <div className="input-group">
                            <label className="input-label">Cuerpo HTML del auto-reply</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'stretch' }}>
                              <textarea
                                className="sig-textarea font-mono"
                                value={currentSettings.auto_reply_body}
                                onChange={e => update({ auto_reply_body: e.target.value })}
                                style={{ fontFamily: 'monospace', fontSize: '0.78rem', resize: 'none', overflow: 'auto', minHeight: '120px', height: '100%', boxSizing: 'border-box' }}
                                placeholder="<p>Gracias por escribirnos...</p>"
                              />
                              <div className="sig-preview-content" style={{ padding: 0, overflow: 'visible', minHeight: '120px' }}>
                                {currentSettings.auto_reply_body ? (
                                  <iframe
                                    srcDoc={currentSettings.auto_reply_body}
                                    sandbox="allow-same-origin"
                                    style={{ width: '100%', border: 'none', display: 'block', height: '0' }}
                                    onLoad={e => {
                                      const iframe = e.currentTarget;
                                      try {
                                        const h = iframe.contentDocument?.documentElement?.scrollHeight;
                                        if (h && h > 50) iframe.style.height = h + 'px';
                                      } catch { /* cross-origin */ }
                                    }}
                                  />
                                ) : (
                                  <span className="placeholder-text-preview" style={{ padding: '12px' }}>Vista previa</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveInboxSettings}
                          disabled={savingInboxSettings}
                        >
                          <Save size={14} />
                          {savingInboxSettings ? 'Guardando…' : 'Guardar configuración'}
                        </button>
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          ) : activeFolder === 'tracking' ? (
            /* SECCIÓN DE SEGUIMIENTO (TRACKING DASHBOARD) */
            <div className="tracking-dashboard-view">
              <div className="campaign-kpis-header">
                <div>
                  <h3>Seguimiento de Correos</h3>
                  <p className="text-muted text-xs">Monitoriza las lecturas, clics y descargas en tiempo real al estilo Mailsuite.</p>
                </div>
              </div>

              {/* Grid de KPIs de Seguimiento */}
              <div className="campaigns-kpi-grid tracking-kpi-grid">
                <div className="kpi-card-mini">
                  <Send size={16} className="text-primary-light" />
                  <div>
                    <p className="kpi-val">{totalTracked}</p>
                    <p className="kpi-lbl">Correos Seguidos</p>
                  </div>
                </div>
                <div className="kpi-card-mini">
                  <Percent size={16} className="text-success-light" />
                  <div>
                    <p className="kpi-val">{openRate}%</p>
                    <p className="kpi-lbl">Tasa de Apertura</p>
                  </div>
                </div>
                <div className="kpi-card-mini">
                  <MousePointerClick size={16} className="text-secondary-light" />
                  <div>
                    <p className="kpi-val">{totalClicks}</p>
                    <p className="kpi-lbl">Clics Totales</p>
                  </div>
                </div>
                <div className="kpi-card-mini">
                  <FileDown size={16} className="text-warning" />
                  <div>
                    <p className="kpi-val">{totalDownloads}</p>
                    <p className="kpi-lbl">Descargas</p>
                  </div>
                </div>
              </div>

              {/* Tabla de Correos en Seguimiento */}
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Destinatario</th>
                      <th>Asunto / Mensaje</th>
                      <th>Estado</th>
                      <th>Enlaces Clicados</th>
                      <th>Descargas</th>
                      <th>Fecha / Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingEmails.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No hay correos en seguimiento.
                        </td>
                      </tr>
                    ) : (
                      trackingEmails.map((email) => {
                        const clicksCount = email.tracking?.clicks?.reduce((s, c) => s + c.clicksCount, 0) ?? 0;
                        const downloadsCount = email.tracking?.downloads?.reduce((s, d) => s + d.downloadsCount, 0) ?? 0;
                        return (
                          <tr key={email.id} onClick={() => { setActiveFolder('sent'); handleSelectEmail(email); }} style={{ cursor: 'pointer' }} className="table-row-hover">
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="email-row-avatar" style={{ width: '24px', height: '24px', fontSize: '0.65rem' }}>
                                  {email.avatar}
                                </div>
                                <span className="camp-name-title" style={{ fontSize: '0.82rem' }}>
                                  {email.recipient || email.senderEmail}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="campaign-name-cell">
                                <span className="camp-name-title">{email.subject}</span>
                                <span className="camp-subject-sub text-muted">{email.snippet}</span>
                              </div>
                            </td>
                            <td>
                              {email.tracking?.status === 'opened' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success-light, #34d399)' }}>
                                  <CheckCheck size={16} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Leído {email.tracking.openedAt}</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                                  <Check size={16} style={{ opacity: 0.6 }} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-darker)' }}>Enviado</span>
                                </div>
                              )}
                            </td>
                            <td>
                              {clicksCount > 0 ? (
                                <div className="tag-target-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.2)', color: 'var(--secondary-light)' }}>
                                  <MousePointerClick size={12} />
                                  <span>{clicksCount} {clicksCount === 1 ? 'clic' : 'clics'}</span>
                                </div>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>
                              )}
                            </td>
                            <td>
                              {downloadsCount > 0 ? (
                                <div className="tag-target-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.2)', color: 'var(--warning)' }}>
                                  <FileDown size={12} />
                                  <span>{downloadsCount} {downloadsCount === 1 ? 'descarga' : 'descargas'}</span>
                                </div>
                              ) : (
                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>-</span>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {email.date} ({email.time})
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* BANDEJA DE ENTRADA / LISTA DE CORREOS */
            <>
              {!selectedEmail && <div className="email-list-view">
              <div className="list-toolbar">
                <div className="toolbar-left">
                  <button onClick={handleToggleSelectAll} className="btn-checkbox" title="Seleccionar todo">
                    {filteredEmails.length > 0 && filteredEmails.every(e => selectedEmailIds.includes(e.id)) ? (
                      <CheckSquare size={16} className="text-primary-light" />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                  
                  {selectedEmailIds.length > 0 && (
                    <div className="toolbar-batch-actions">
                      {activeFolder === 'trash' ? (
                        <>
                          <button onClick={() => restoreFromTrash()} className="btn-toolbar-action" title="Restaurar a bandeja original">
                            <MailCheck size={15} />
                          </button>
                          <button onClick={() => deleteSelectedPermanently()} className="btn-toolbar-action text-danger-light" title="Eliminar definitivamente">
                            <Trash2 size={15} />
                          </button>
                        </>
                      ) : (
                        <button onClick={moveSelectedToTrash} className="btn-toolbar-action" title="Mover a papelera">
                          <Trash2 size={15} />
                        </button>
                      )}
                      <button onClick={() => {
                        setEmails(prev => prev.map(e => selectedEmailIds.includes(e.id) ? { ...e, read: true } : e));
                        setSelectedEmailIds([]);
                      }} className="btn-toolbar-action" title="Marcar como leído">
                        <Inbox size={15} />
                      </button>
                      <span className="selected-counter">{selectedEmailIds.length} seleccionados</span>
                    </div>
                  )}
                </div>

                <div className="toolbar-right">
                  {activeFolder === 'trash' && (
                    <button onClick={emptyTrash} className="btn btn-secondary btn-sm text-danger-light" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      Vaciar papelera
                    </button>
                  )}
                  <span className="page-indicator">1-{filteredEmails.length} de {filteredEmails.length}</span>
                </div>
              </div>


              {/* Lista real de correos */}
              <div className="emails-scroll-area">
                {filteredEmails.length === 0 ? (
                  <div className="empty-mailbox">
                    <Mail size={36} className="text-muted mb-3" />
                    <h4>No hay mensajes aquí</h4>
                    <p className="text-muted text-xs">La bandeja de entrada está limpia y al día.</p>
                  </div>
                ) : (
                  filteredEmails.map((email) => (
                    <div 
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={`email-row-item ${email.read ? 'read' : 'unread'} ${selectedEmailIds.includes(email.id) ? 'selected' : ''}`}
                    >
                      <div 
                        onClick={(e) => handleToggleSelectOne(email.id, e)}
                        className="email-item-checkbox"
                      >
                        {selectedEmailIds.includes(email.id) ? (
                          <CheckSquare size={14} className="text-primary-light" />
                        ) : (
                          <Square size={14} />
                        )}
                      </div>

                      <div className="email-item-actions">
                        <button 
                          onClick={(e) => toggleStar(email.id, e)} 
                          className={`action-btn-star ${email.starred ? 'starred' : ''}`}
                        >
                          <Star size={14} />
                        </button>
                        <button 
                          onClick={(e) => toggleImportant(email.id, e)} 
                          className={`action-btn-important ${email.important ? 'important' : ''}`}
                        >
                          <Tag size={13} />
                        </button>
                      </div>

                      <div className="email-item-sender">
                        <div className="email-row-avatar" style={{ position: 'relative' }}>
                          <span className="avatar-text">{email.avatar}</span>
                          {(() => {
                            const fbs = [
                              mailboxCustomizations[email.senderEmail]?.avatar,
                              gravatarUrl(email.senderEmail),
                              email.avatarUrl,
                              isImageAvatar(email.avatar) ? email.avatar : null,
                            ].filter(Boolean) as string[];
                            return <img src={fbs[0]} alt={email.sender} data-fi="0"
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                              onLoad={e => { const img = e.currentTarget as HTMLImageElement; if (img.naturalWidth < 2) img.style.display = 'none'; }}
                              onError={e => {
                                const img = e.currentTarget as HTMLImageElement;
                                const i = parseInt(img.dataset.fi ?? '0', 10) + 1;
                                if (fbs[i]) { img.dataset.fi = String(i); img.src = fbs[i]; } else img.style.display = 'none';
                              }}
                            />;
                          })()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                          <span
                            className="sender-name"
                            title={(email.folder === 'sent' && email.recipient) ? email.recipient : email.senderEmail}
                          >
                            {(email.folder === 'sent' && email.recipient)
                              ? `Para: ${email.recipient}`
                              : email.sender
                            }
                          </span>
                          {(() => {
                            const chipEmail = email.folder === 'sent' ? email.senderEmail : email.toEmail;
                            if (!chipEmail) return null;
                            const mbox = MAILBOXES.find(m => m.email === chipEmail);
                            if (!mbox) return null;
                            const custom = mailboxCustomizations[chipEmail];
                            const label = custom?.displayName || chipEmail.split('@')[0];
                            const color = custom?.color || mbox.color || '#8b5cf6';
                            return (
                              <span style={{ padding: '0px 6px', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600, background: `${color}22`, color: color, border: `1px solid ${color}44`, whiteSpace: 'nowrap', alignSelf: 'flex-start', lineHeight: '1.6' }}>
                                {label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="email-item-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span className="email-subject" style={{ flexShrink: 0 }}>{email.subject}</span>

                        {/* Chips de etiquetas */}
                        {email.labels && email.labels.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                            {email.labels.map(lblId => {
                              const lbl = Object.values(mailboxLabels).flat().find(l => l.id === lblId);
                              if (!lbl) return null;
                              return (
                                <span 
                                  key={lbl.id}
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    background: `${lbl.color}20`,
                                    color: lbl.color,
                                    border: `1px solid ${lbl.color}40`,
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {lbl.name}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <span className="email-separator" style={{ flexShrink: 0 }}> - </span>
                        <span className="email-snippet" style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{email.snippet}</span>
                      </div>

                      {email.attachments && email.attachments.length > 0 && (
                        <div className="email-item-attachment-icon">
                          <Paperclip size={12} className="text-muted" />
                        </div>
                      )}

                      {email.tracking && (
                        <div 
                          className="email-item-tracking-icon" 
                          style={{ marginRight: '12px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTrackingEmail(email);
                            setIsTrackingModalOpen(true);
                          }}
                        >
                          {email.tracking.status === 'opened' ? (
                            <span title="Leído por el destinatario"><CheckCheck size={16} className="text-success-light" style={{ color: 'var(--success-light, #34d399)' }} /></span>
                          ) : email.tracking.status === 'delivered' ? (
                            <span title="Recibido por el destinatario"><CheckCheck size={16} className="text-muted" style={{ opacity: 0.6 }} /></span>
                          ) : (
                            <span title="Enviado"><Check size={16} className="text-muted" style={{ opacity: 0.6 }} /></span>
                          )}
                        </div>
                      )}

                      <div className="email-item-date">
                        <span>{email.time}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>}

            {selectedEmail && (() => {
              const currentIdx = filteredEmails.findIndex(e => e.id === selectedEmail.id);
              const goToPrev = () => { if (currentIdx > 0) handleSelectEmail(filteredEmails[currentIdx - 1]); };
              const goToNext = () => { if (currentIdx < filteredEmails.length - 1) handleSelectEmail(filteredEmails[currentIdx + 1]); };
              return (
              <div className="email-detail-view">

              {/* ── TOOLBAR ESTILO GMAIL ── */}
              <div className="gm-detail-toolbar">
                <div className="gm-toolbar-left">
                  <button onClick={() => setSelectedEmail(null)} className="gm-toolbar-btn" title="Volver">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="gm-toolbar-sep" />
                  {activeFolder === 'trash' ? (
                    <>
                      <button onClick={() => restoreFromTrash()} className="gm-toolbar-btn" title="Restaurar">
                        <MailCheck size={17} />
                      </button>
                      <button onClick={() => deleteSelectedPermanently()} className="gm-toolbar-btn gm-danger" title="Eliminar definitivamente">
                        <Trash2 size={17} />
                      </button>
                    </>
                  ) : (
                    <button onClick={moveSelectedToTrash} className="gm-toolbar-btn" title="Mover a papelera">
                      <Trash2 size={17} />
                    </button>
                  )}
                  <button onClick={(e) => toggleImportant(selectedEmail.id, e)} className={`gm-toolbar-btn ${selectedEmail.important ? 'gm-active' : ''}`} title="Marcar importante">
                    <Tag size={16} />
                  </button>
                </div>
                <div className="gm-toolbar-right">
                  <span className="gm-nav-count">
                    {currentIdx >= 0 ? currentIdx + 1 : '–'} de {filteredEmails.length}
                  </span>
                  <button onClick={goToPrev} className="gm-toolbar-btn" disabled={currentIdx <= 0} title="Anterior">
                    <ChevronLeft size={18} />
                  </button>
                  <button onClick={goToNext} className="gm-toolbar-btn" disabled={currentIdx >= filteredEmails.length - 1} title="Siguiente">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* ── ASUNTO ── */}
              <div className="gm-subject-row">
                <h1 className="gm-subject-title">{selectedEmail.subject}</h1>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedEmail.isContact && (
                      <span className="contact-real-badge">
                        ● CONTACTO REAL
                      </span>
                    )}
                    {selectedEmail.replied && (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>✓ RESPONDIDO</span>
                    )}
                    {/* Lista de etiquetas del correo en detalle con botón de borrar y de añadir */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedEmail.labels?.map(lblId => {
                        const lbl = Object.values(mailboxLabels).flat().find(l => l.id === lblId);
                        if (!lbl) return null;
                        return (
                          <span 
                            key={lbl.id}
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: `${lbl.color}20`,
                              color: lbl.color,
                              border: `1px solid ${lbl.color}40`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {lbl.name}
                            <button
                              type="button"
                              onClick={() => handleToggleLabelOnEmail(selectedEmail.id, lbl.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: lbl.color,
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                      
                      {/* Botón "+ Etiqueta" con un dropdown compacto */}
                      <div ref={addLabelDropdownRef} style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIsAddLabelDropdownOpen(prev => !prev)}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'var(--text-light)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Plus size={10} /> Etiqueta
                        </button>
                        
                        {isAddLabelDropdownOpen && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            zIndex: 100,
                            background: 'rgba(19, 24, 38, 0.95)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '6px',
                            minWidth: '150px',
                            boxShadow: 'var(--shadow-glow)',
                            backdropFilter: 'blur(8px)'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {(mailboxLabels[selectedEmail.senderEmail === activeMailbox ? selectedEmail.senderEmail : activeMailbox] || []).map(lbl => {
                                const isAssigned = selectedEmail.labels?.includes(lbl.id);
                                return (
                                  <button
                                    key={lbl.id}
                                    type="button"
                                    onClick={() => handleToggleLabelOnEmail(selectedEmail.id, lbl.id)}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      textAlign: 'left',
                                      background: isAssigned ? 'rgba(255,255,255,0.08)' : 'transparent',
                                      color: isAssigned ? lbl.color : 'var(--text-light)',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      width: '100%'
                                    }}
                                  >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lbl.color }} />
                                      {lbl.name}
                                    </span>
                                    {isAssigned && <Check size={10} />}
                                  </button>
                                );
                              })}
                              {(mailboxLabels[selectedEmail.senderEmail === activeMailbox ? selectedEmail.senderEmail : activeMailbox] || []).length === 0 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-darker)', padding: '6px' }}>Crea etiquetas en la barra superior.</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                </div>
              </div>

              {/* ── REMITENTE ESTILO GMAIL ── */}
              <div className="gm-sender-row">
                <div className="gm-sender-avatar" style={{ position: 'relative' }}>
                  <span className="avatar-text">{selectedEmail.avatar || '?'}</span>
                  {(() => {
                    const fbs = [
                      mailboxCustomizations[selectedEmail.senderEmail]?.avatar,
                      gravatarUrl(selectedEmail.senderEmail),
                      selectedEmail.avatarUrl,
                      isImageAvatar(selectedEmail.avatar) ? selectedEmail.avatar : null,
                    ].filter(Boolean) as string[];
                    return <img src={fbs[0]} alt={selectedEmail.sender} data-fi="0"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                      onLoad={e => { const img = e.currentTarget as HTMLImageElement; if (img.naturalWidth < 2) img.style.display = 'none'; }}
                      onError={e => {
                        const img = e.currentTarget as HTMLImageElement;
                        const i = parseInt(img.dataset.fi ?? '0', 10) + 1;
                        if (fbs[i]) { img.dataset.fi = String(i); img.src = fbs[i]; } else img.style.display = 'none';
                      }}
                    />;
                  })()}
                </div>
                <div className="gm-sender-info">
                  <div className="gm-sender-top">
                    <span className="gm-sender-name">{selectedEmail.sender}</span>
                    <span className="gm-sender-email">&lt;{selectedEmail.senderEmail}&gt;</span>
                    {selectedEmail.isContact && <span className="contact-real-badge">● CONTACTO</span>}
                    {selectedEmail.replied && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>✓ RESPONDIDO</span>}
                  </div>
                  <div className="gm-sender-bottom">
                    <span>para <strong>{selectedEmail.toEmail || activeMailbox}</strong></span>
                  </div>
                </div>
                <div className="gm-sender-actions">
                  <span className="gm-timestamp">{selectedEmail.date} {selectedEmail.time}</span>
                  <button onClick={(e) => toggleStar(selectedEmail.id, e)} className={`gm-toolbar-btn ${selectedEmail.starred ? 'gm-starred' : ''}`} title="Destacar">
                    <Star size={16} />
                  </button>
                   {selectedEmail.tracking && (
                    <button 
                      onClick={() => { setTrackingEmail(selectedEmail); setIsTrackingModalOpen(true); }} 
                      className="gm-toolbar-btn" 
                      title="Ver seguimiento" 
                      style={{ 
                        color: selectedEmail.tracking.status === 'opened' ? 'var(--success-light, #34d399)' : 'var(--text-muted)', 
                        opacity: selectedEmail.tracking.status === 'sent' ? 0.6 : 1 
                      }}
                    >
                      {selectedEmail.tracking.status === 'opened' ? (
                        <CheckCheck size={16} />
                      ) : selectedEmail.tracking.status === 'delivered' ? (
                        <CheckCheck size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                    </button>
                  )}
                  <button onClick={() => { setIsReplyModalOpen(true); setReplyBody(''); }} className="gm-toolbar-btn" title="Responder">
                    <CornerUpLeft size={16} />
                  </button>
                </div>
              </div>

              {/* Cuerpo del correo */}
              <div className="email-body-scroll">
              <iframe
                srcDoc={(() => {
                  const script = '<script>function _sh(){var h=Math.max(document.body.scrollHeight,document.body.offsetHeight,document.documentElement.scrollHeight,document.documentElement.offsetHeight);window.parent.postMessage({t:"emailH",v:h+32},"*")}window.addEventListener("load",function(){requestAnimationFrame(function(){requestAnimationFrame(_sh)})});setTimeout(_sh,600);setTimeout(_sh,1800);setTimeout(_sh,4000);<\/script>';
                  const inject = '<meta charset="utf-8"><base target="_blank" rel="noopener"><style>body { font-family: sans-serif; line-height: 1.7; color: #1a1a2e; margin: 16px; }</style>' + script;
                  let html = selectedEmail.body.replace(/<meta[^>]+charset[^>]*>/gi, '');
                  if (selectedEmail.senderEmail === activeMailbox) {
                    html = html.replace(/<img[^>]+functions\/v1\/track-open[^>]*>/gi, '');
                  }
                  if (/<head/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + inject);
                  if (/<html/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + `<head>${inject}</head>`);
                  return `<!DOCTYPE html><html><head>${inject}</head><body>${html}</body></html>`;
                })()}
                sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                style={{ width: '100%', border: 'none', display: 'block', overflow: 'hidden', height: '100%' }}
              />

              {/* Modal de seguimiento — renderizado fuera del flujo del body */}

              {/* Adjuntos */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="detail-attachments-box">
                  <span className="attachments-title">Adjuntos ({selectedEmail.attachments.length})</span>
                  <div className="attachments-list">
                    {selectedEmail.attachments.map((file, i) => {
                      const isImg = file.type.startsWith('image/');
                      const isZip = file.type.includes('zip') || file.type.includes('compressed') || file.name.match(/\.(zip|rar|7z|tar|gz)$/i);
                      const Icon = isImg ? ImageIcon : isZip ? FileArchive : FileText;
                      const sizeLabel = file.size > 1024 * 1024
                        ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                        : `${Math.round(file.size / 1024)} KB`;
                      return (
                        <a key={i} href={file.url} download={file.name} target="_blank" rel="noreferrer"
                          className="attachment-file-card" title={`Descargar ${file.name}`}>
                          {isImg
                            ? <img src={file.url} alt={file.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                            : <Icon size={18} className="text-primary-light" />
                          }
                          <div className="file-meta">
                            <p className="file-name">{file.name}</p>
                            <p className="file-size">{sizeLabel}</p>
                          </div>
                          <Download size={13} className="text-muted" style={{ marginLeft: 4 }} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              </div>{/* /email-body-scroll */}

              {/* ── PIE ESTILO GMAIL ── */}
              <div className="gm-footer-actions">
                <button
                  onClick={() => { setIsReplyModalOpen(true); setReplyBody(''); }}
                  className="gm-footer-btn"
                >
                  <CornerUpLeft size={15} />
                  <span>Responder</span>
                </button>
                <button
                  onClick={() => {
                    setComposeTo(selectedEmail.senderEmail);
                    setComposeSubject(`Fwd: ${selectedEmail.subject}`);
                    setIsComposeOpen(true);
                  }}
                  className="gm-footer-btn"
                >
                  <Forward size={15} />
                  <span>Reenviar</span>
                </button>
              </div>

              {/* PANEL DE RESPUESTA */}
              {(selectedEmail.isContact || selectedEmail.isInbound) && isReplyModalOpen && (
                <div className="contact-reply-panel">
                  <div className="reply-panel-header">
                    <CornerUpLeft size={15} className="text-primary-light" />
                    <span>Responder a <strong>{selectedEmail.sender}</strong> ({selectedEmail.senderEmail})</span>
                  </div>
                  <textarea
                    className="form-input form-textarea reply-textarea"
                    rows={6}
                    placeholder={`Escribe tu respuesta a ${selectedEmail.sender}...`}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    autoFocus
                  />
                  <div className="reply-panel-actions">
                    <button
                      disabled={isSendingReply || !replyBody.trim()}
                      onClick={async () => {
                        if (!replyBody.trim()) return;
                        if (!selectedEmail._contactId && !selectedEmail._inboundId) return;
                        setIsSendingReply(true);
                        try {
                          // 1. Enviar el correo real via Resend
                          const htmlReply = `<div style="font-family:sans-serif;line-height:1.7;color:#1a1a2e;max-width:600px;">${replyBody.replace(/\n/g, '<br/>')}</div>`;

                          const sendResult = await sendEmail({
                            to: selectedEmail.senderEmail,
                            subject: `Re: ${selectedEmail.subject}`,
                            html: htmlReply,
                            from: `Fycheo <${activeMailbox}>`,
                            replyTo: activeMailbox,
                          });

                          if (!sendResult.success) {
                            showToast(`Error al enviar: ${sendResult.error}`, 'error');
                            return;
                          }

                          // 2. Marcar como respondido en Supabase
                          if (selectedEmail._contactId) {
                            await markContactReplied(selectedEmail._contactId, replyBody);
                          } else if (selectedEmail._inboundId) {
                            await markInboundReplied(selectedEmail._inboundId, replyBody);
                          }

                          // 3. Actualizar estado local
                          setEmails(prev => prev.map(e =>
                            e.id === selectedEmail.id
                              ? { ...e, replied: true, reply_body: replyBody }
                              : e
                          ));
                          setSelectedEmail(prev => prev ? { ...prev, replied: true } : null);
                          setIsReplyModalOpen(false);
                          setReplyBody('');
                          showToast(`Respuesta enviada a ${selectedEmail.senderEmail}`, 'success');
                        } finally {
                          setIsSendingReply(false);
                        }
                      }}
                      className="btn btn-primary"
                    >
                      {isSendingReply ? (
                        <RefreshCw size={14} className="sync-icon spinning" />
                      ) : (
                        <Send size={14} />
                      )}
                      <span>{isSendingReply ? 'Enviando...' : 'Enviar respuesta'}</span>
                    </button>
                    <button
                      onClick={() => { setIsReplyModalOpen(false); setReplyBody(''); }}
                      className="btn btn-secondary"
                    >
                      <X size={14} />
                      <span>Cancelar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
              );
            })()}
            </>
          )}
        </div>
      </div>
    </div>
    )}

      {/* COMPOSER FLOTANTE TIPO GMAIL */}
      {isComposeOpen && (
        <div className={`gmail-composer-floating ${isComposeMaximized ? 'maximized' : ''}`}>
          <div className="composer-header">
            <span>Mensaje nuevo</span>
            <div className="header-window-actions">
              <button 
                onClick={() => setIsComposeMaximized(!isComposeMaximized)} 
                className="window-action-btn"
              >
                {isComposeMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button onClick={() => setIsComposeOpen(false)} className="window-action-btn close-btn">
                <X size={14} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSendEmail} className="composer-form">
            <div className="composer-field border-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '8px' }}>
                <span className="field-label" style={{ minWidth: '60px', marginBottom: 0 }}>Plantilla:</span>
                <div style={{ flex: 1 }}>
                  <CustomSelect
                    value={composeTemplateId}
                    onChange={handleLoadTemplateToComposer}
                    options={[
                      { value: 'none', label: '-- Ninguna --' },
                      ...templates.map(t => ({
                        value: t.id,
                        label: t.name
                      }))
                    ]}
                    placeholder="-- Seleccionar plantilla --"
                  />
                </div>
              </div>

              {/* Selector de Etiquetas en la misma fila */}
              <div ref={composeLabelsDropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setIsComposeLabelsDropdownOpen(prev => !prev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: composeLabels.length > 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid ' + (composeLabels.length > 0 ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-color)'),
                    color: composeLabels.length > 0 ? '#a5b4fc' : 'var(--text-darker)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minHeight: '34px'
                  }}
                  onMouseEnter={(e) => {
                    if (composeLabels.length === 0) {
                      e.currentTarget.style.color = 'white';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (composeLabels.length === 0) {
                      e.currentTarget.style.color = 'var(--text-darker)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                >
                  <Tag 
                    size={15} 
                    style={{ 
                      color: composeLabels.length > 0 ? '#6366f1' : 'var(--text-darker)',
                      opacity: composeLabels.length > 0 ? 1 : 0.4,
                      transition: 'all 0.2s'
                    }} 
                  />
                  {composeLabels.length > 0 && (
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      {composeLabels.map(lblId => {
                        const lbl = Object.values(mailboxLabels).flat().find(l => l.id === lblId);
                        if (!lbl) return null;
                        return (
                          <span 
                            key={lbl.id}
                            style={{
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              background: `${lbl.color}25`,
                              color: lbl.color,
                              border: `1px solid ${lbl.color}35`,
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {lbl.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <ChevronDown 
                    size={12} 
                    style={{ 
                      transform: isComposeLabelsDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', 
                      transition: 'transform 0.2s',
                      opacity: composeLabels.length > 0 ? 0.8 : 0.4
                    }} 
                  />
                </button>

                {isComposeLabelsDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '6px',
                    zIndex: 1000,
                    background: 'rgba(19, 24, 38, 0.98)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '8px',
                    boxShadow: 'var(--shadow-glow)',
                    backdropFilter: 'blur(16px)',
                    width: '220px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {(mailboxLabels[composeFrom || (activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox)] || []).map(lbl => {
                      const isSelected = composeLabels.includes(lbl.id);
                      return (
                        <button
                          key={lbl.id}
                          type="button"
                          onClick={() => {
                            setComposeLabels(prev => 
                              prev.includes(lbl.id) 
                                ? prev.filter(id => id !== lbl.id) 
                                : [...prev, lbl.id]
                            );
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                            border: '1px solid ' + (isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent'),
                            color: isSelected ? 'white' : 'var(--text-darker)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isSelected ? 'rgba(255, 255, 255, 0.05)' : 'transparent';
                            e.currentTarget.style.color = isSelected ? 'white' : 'var(--text-darker)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Tag size={12} style={{ color: lbl.color }} />
                            <span>{lbl.name}</span>
                          </div>
                          {isSelected && <Check size={12} style={{ color: 'var(--primary-color)' }} />}
                        </button>
                      );
                    })}
                    {(mailboxLabels[composeFrom || (activeMailbox === 'all' ? MAILBOXES[0].email : activeMailbox)] || []).length === 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-darker)', padding: '6px', textAlign: 'center' }}>
                        Sin etiquetas creadas.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="composer-field border-bottom">
              <span className="field-label" style={{ minWidth: '32px' }}>De:</span>
              <CustomSelect
                value={composeFrom}
                onChange={handleComposeFromChange}
                options={filteredMailboxes.map(m => {
                  const displayName = mailboxCustomizations[m.email]?.displayName || m.displayName;
                  const avatarVal = mailboxCustomizations[m.email]?.avatar || m.label.slice(0, 2).toUpperCase();
                  const colorVal = mailboxCustomizations[m.email]?.color || m.color;
                  return {
                    value: m.email,
                    label: `${displayName} <${m.email}>`,
                    icon: (
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: isImageAvatar(avatarVal) ? 'transparent' : colorVal,
                        color: 'white',
                        fontSize: '0.55rem',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {isImageAvatar(avatarVal) ? (
                          <img src={avatarVal} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          avatarVal
                        )}
                      </div>
                    )
                  };
                })}
              />
            </div>

            <div className="composer-field border-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px', flexWrap: 'wrap', minHeight: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                <span className="field-label" style={{ minWidth: '40px', userSelect: 'none' }}>Para:</span>
                {(() => {
                  const clean = composeTo.replace(/;/g, ',');
                  const targets = clean.split(',').map(e => e.trim()).filter(e => e.length > 0);
                  if (targets.length <= 1) return null;
                  return (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#a5b4fc', cursor: 'pointer', marginRight: '6px', userSelect: 'none', background: 'rgba(99, 102, 241, 0.12)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.25)', flexShrink: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={sendIndividually} 
                        onChange={(e) => setSendIndividually(e.target.checked)} 
                        style={{ cursor: 'pointer', accentColor: 'var(--primary, #6366f1)', width: '12px', height: '12px', margin: 0 }}
                      />
                      <span>Envío individual</span>
                    </label>
                  );
                })()}
                {(() => {
                  const list = composeTo ? composeTo.split(',').map(e => e.trim()).filter(Boolean) : [];
                  return list.map((email, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        background: 'rgba(255, 255, 255, 0.07)', 
                        border: '1px solid rgba(255, 255, 255, 0.12)', 
                        padding: '2px 8px', 
                        borderRadius: '16px', 
                        fontSize: '0.75rem', 
                        color: 'white',
                        userSelect: 'none'
                      }}
                    >
                      <span>{email}</span>
                      <span 
                        onClick={() => removeRecipient(idx)} 
                        style={{ 
                          cursor: 'pointer', 
                          color: 'rgba(255, 255, 255, 0.4)', 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '1px'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)')}
                      >✕</span>
                    </div>
                  ));
                })()}
                <input 
                  type="text" 
                  placeholder={(composeTo ? composeTo.split(',').map(e => e.trim()).filter(Boolean) : []).length === 0 ? "correo@ejemplo.com" : ""}
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onBlur={() => {
                    if (toInput) addRecipient(toInput);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                      e.preventDefault();
                      addRecipient(toInput);
                    } else if (e.key === 'Backspace' && !toInput) {
                      const list = composeTo ? composeTo.split(',').map(e => e.trim()).filter(Boolean) : [];
                      if (list.length > 0) {
                        removeRecipient(list.length - 1);
                      }
                    }
                  }}
                  className="composer-input"
                  style={{ 
                    border: 'none', 
                    outline: 'none', 
                    background: 'transparent', 
                    color: 'white', 
                    flex: 1, 
                    minWidth: '120px', 
                    fontSize: '0.85rem', 
                    padding: '4px 0',
                    width: 'auto'
                  }}
                  required={(!composeTo || composeTo.trim() === '')}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-darker)', userSelect: 'none' }}>

                {!showCcField && (
                  <button 
                    type="button" 
                    onClick={() => setShowCcField(true)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-darker)', 
                      cursor: 'pointer', 
                      padding: '2px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-darker)'}
                  >
                    Cc
                  </button>
                )}
                {!showBccField && (
                  <button 
                    type="button" 
                    onClick={() => setShowBccField(true)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-darker)', 
                      cursor: 'pointer', 
                      padding: '2px 6px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      borderRadius: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-darker)'}
                  >
                    Cco
                  </button>
                )}
              </div>
            </div>

            {showCcField && (
              <div className="composer-field border-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span className="field-label" style={{ minWidth: '40px' }}>Cc:</span>
                  <input 
                    type="text" 
                    placeholder="copia@ejemplo.com"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    className="composer-input"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => { setShowCcField(false); setComposeCc(''); }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--text-darker)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-darker)'}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {showBccField && (
              <div className="composer-field border-bottom" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <span className="field-label" style={{ minWidth: '40px' }}>Cco:</span>
                  <input 
                    type="text" 
                    placeholder="copia_oculta@ejemplo.com"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    className="composer-input"
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => { setShowBccField(false); setComposeBcc(''); }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--text-darker)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-darker)'}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="composer-field border-bottom">
              <span className="field-label">Asunto:</span>
              <input 
                type="text" 
                placeholder="Escribe el título..."
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="composer-input"
                required
              />
            </div>



            <div className="composer-body-area" style={{ position: 'relative' }}>
              {isHtmlMode && composeViewMode === 'raw' ? (
                <textarea
                  placeholder="Escribe el HTML aquí..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="composer-textarea"
                  required
                />
              ) : (
                <div
                  ref={previewDivRef}
                  className="composer-editor-content"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => setComposeBody((e.currentTarget as HTMLDivElement).innerHTML)}
                  onClick={(e) => {
                    const target = (e.target as HTMLElement).closest('a');
                    if (target) {
                      e.preventDefault();
                      const editorRect = previewDivRef.current!.getBoundingClientRect();
                      const rect = target.getBoundingClientRect();
                      setLinkEditUrl(target.getAttribute('href') || '');
                      setLinkEditText(target.textContent || '');
                      setLinkEditPopover({
                        x: rect.left - editorRect.left,
                        y: rect.bottom - editorRect.top + 4,
                        url: target.getAttribute('href') || '',
                        el: target as HTMLAnchorElement,
                      });
                    } else {
                      setLinkEditPopover(null);
                    }
                  }}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    background: 'transparent',
                    padding: 0,
                    color: '#1a1a2e',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    minHeight: 0,
                    outline: 'none',
                    cursor: 'text'
                  }}
                  dangerouslySetInnerHTML={composeBody ? undefined : { __html: '' }}
                />
              )}

              {/* POPOVER EDICIÓN DE ENLACE */}
              {linkEditPopover && (
              <div
                style={{
                  position: 'absolute',
                  top: linkEditPopover.y,
                  left: linkEditPopover.x,
                  zIndex: 9999,
                  background: '#1a1f35',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minWidth: 280,
                }}
                onMouseDown={e => e.stopPropagation()}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Editar enlace</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0 10px' }}>
                  <Type size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    autoFocus
                    type="text"
                    value={linkEditText}
                    onChange={e => setLinkEditText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setLinkEditPopover(null); }}
                    placeholder="Texto visible"
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '6px 0', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '0 10px' }}>
                  <Globe size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    type="text"
                    value={linkEditUrl}
                    onChange={e => setLinkEditUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        linkEditPopover.el.setAttribute('href', linkEditUrl);
                        if (linkEditText) linkEditPopover.el.textContent = linkEditText;
                        setComposeBody(previewDivRef.current?.innerHTML ?? '');
                        setLinkEditPopover(null);
                      }
                      if (e.key === 'Escape') setLinkEditPopover(null);
                    }}
                    placeholder="https://..."
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '6px 0', fontSize: '0.8rem', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      linkEditPopover.el.setAttribute('href', linkEditUrl);
                      if (linkEditText) linkEditPopover.el.textContent = linkEditText;
                      setComposeBody(previewDivRef.current?.innerHTML ?? '');
                      setLinkEditPopover(null);
                    }}
                    style={{ flex: 1, background: 'rgba(165,180,252,0.2)', border: '1px solid rgba(165,180,252,0.3)', borderRadius: 6, color: '#a5b4fc', padding: '5px 0', fontSize: '0.75rem', cursor: 'pointer' }}
                  >Aplicar</button>
                  <button
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      const parent = linkEditPopover.el.parentNode;
                      if (parent) {
                        while (linkEditPopover.el.firstChild) parent.insertBefore(linkEditPopover.el.firstChild, linkEditPopover.el);
                        parent.removeChild(linkEditPopover.el);
                      }
                      setComposeBody(previewDivRef.current?.innerHTML ?? '');
                      setLinkEditPopover(null);
                    }}
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                  >Quitar enlace</button>
                </div>
              </div>
            )}
            </div>

            <div style={{ position: 'relative' }}>
              {showTypographyPopover && (
                <div className="composer-format-bar">
                      {/* Fuente — desplegable custom */}
                      {(() => {
                        const fontOptions = [
                          { label: 'Sans Serif',   value: 'Arial, Helvetica, sans-serif' },
                          { label: 'Serif',        value: "Georgia, 'Times New Roman', serif" },
                          { label: 'Ancho fijo',   value: "'Courier New', Courier, monospace" },
                          { label: 'Wide',         value: "'Arial Black', Gadget, sans-serif" },
                          { label: 'Narrow',       value: "'Arial Narrow', Arial, sans-serif" },
                          { label: 'Comic Sans MS',value: "'Comic Sans MS', cursive" },
                          { label: 'Garamond',     value: 'Garamond, serif' },
                          { label: 'Georgia',      value: 'Georgia, serif' },
                          { label: 'Tahoma',       value: 'Tahoma, Geneva, sans-serif' },
                          { label: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, Arial, sans-serif" },
                          { label: 'Verdana',      value: 'Verdana, Geneva, sans-serif' },
                        ];
                        return (
                          <div style={{ position: 'relative' }}>
                            <div
                              className="format-bar-btn"
                              onMouseDown={e => { e.preventDefault(); setShowFontDropdown(p => !p); setShowSizeDropdown(false); setShowAlignDropdown(false); }}
                              style={{ gap: 4, minWidth: 72, justifyContent: 'space-between', paddingRight: 4 }}
                            >
                              <span style={{ fontSize: '0.75rem', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentFont.label}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                            </div>
                            {showFontDropdown && (
                              <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, background: '#1a1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 700, minWidth: 130 }}>
                                {fontOptions.map(f => (
                                  <div
                                    key={f.value}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('fontName', false, f.value); setComposeBody(previewDivRef.current.innerHTML); }
                                      setCurrentFont(f);
                                      setShowFontDropdown(false);
                                    }}
                                    style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', fontFamily: f.value, background: currentFont.value === f.value ? 'rgba(165,180,252,0.15)' : 'transparent', whiteSpace: 'nowrap' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = currentFont.value === f.value ? 'rgba(165,180,252,0.15)' : 'transparent')}
                                  >{f.label}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Tamaño — desplegable custom */}
                      {(() => {
                        const sizes = ['10','12','14','16','18','20','24','28','32','36'];
                        return (
                          <div style={{ position: 'relative' }}>
                            <div
                              className="format-bar-btn"
                              onMouseDown={e => { e.preventDefault(); setShowSizeDropdown(p => !p); setShowFontDropdown(false); setShowAlignDropdown(false); }}
                              style={{ gap: 3, minWidth: 40, justifyContent: 'space-between', paddingRight: 4 }}
                            >
                              <span style={{ fontSize: '0.75rem' }}>{currentSize}</span>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                            </div>
                            {showSizeDropdown && (
                              <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, background: '#1a1f35', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', zIndex: 700, minWidth: 60 }}>
                                {sizes.map(sz => (
                                  <div
                                    key={sz}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      if (previewDivRef.current) {
                                        previewDivRef.current.focus();
                                        document.execCommand('fontSize', false, '7');
                                        previewDivRef.current.querySelectorAll('font[size="7"]').forEach(s => {
                                          (s as HTMLElement).removeAttribute('size');
                                          (s as HTMLElement).style.fontSize = sz + 'px';
                                        });
                                        setComposeBody(previewDivRef.current.innerHTML);
                                      }
                                      setCurrentSize(sz);
                                      setShowSizeDropdown(false);
                                    }}
                                    style={{ padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', background: currentSize === sz ? 'rgba(165,180,252,0.15)' : 'transparent', textAlign: 'center' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = currentSize === sz ? 'rgba(165,180,252,0.15)' : 'transparent')}
                                  >{sz}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div className="format-bar-sep" />

                      {/* Negrita */}
                      <div className="format-bar-btn" title="Negrita (Ctrl+B)" style={{ fontWeight: 700 }}
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('bold'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >B</div>

                      {/* Cursiva */}
                      <div className="format-bar-btn" title="Cursiva (Ctrl+I)" style={{ fontStyle: 'italic' }}
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('italic'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >I</div>

                      {/* Subrayado */}
                      <div className="format-bar-btn" title="Subrayado (Ctrl+U)" style={{ textDecoration: 'underline' }}
                        onMouseDown={e => {
                          e.preventDefault();
                          if (!previewDivRef.current) return;
                          // Si la selección está dentro de un <a>, alterna text-decoration en el enlace
                          const sel = window.getSelection();
                          const anchor = sel?.anchorNode ? (sel.anchorNode as HTMLElement).closest?.('a') ?? (sel.anchorNode.parentElement?.closest('a')) : null;
                          if (anchor) {
                            anchor.style.textDecoration = anchor.style.textDecoration === 'none' ? '' : 'none';
                          } else {
                            previewDivRef.current.focus();
                            document.execCommand('underline');
                          }
                          setComposeBody(previewDivRef.current.innerHTML);
                        }}
                      >U</div>

                      {/* Color de texto */}
                      <div className="format-bar-btn format-bar-color-btn" title="Color de texto">
                        <span style={{ fontWeight: 700, borderBottom: '2px solid #e44' }}>A</span>
                        <input type="color" defaultValue="#ee4444"
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => {
                            if (previewDivRef.current) {
                              previewDivRef.current.focus();
                              document.execCommand('foreColor', false, e.target.value);
                              setComposeBody(previewDivRef.current.innerHTML);
                            }
                          }}
                          style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                        />
                      </div>

                      <div className="format-bar-sep" />

                      {/* Alineación — desplegable vertical */}
                      {(() => {
                        const alignOptions = [
                          { cmd: 'justifyLeft',   title: 'Izquierda',   svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="10" x2="14" y2="10"/><line x1="3" y1="15" x2="18" y2="15"/><line x1="3" y1="20" x2="12" y2="20"/></svg> },
                          { cmd: 'justifyCenter', title: 'Centrar',     svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="5" x2="21" y2="5"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="5" y1="15" x2="19" y2="15"/><line x1="9" y1="20" x2="15" y2="20"/></svg> },
                          { cmd: 'justifyRight',  title: 'Derecha',     svg: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="5" x2="21" y2="5"/><line x1="10" y1="10" x2="21" y2="10"/><line x1="6" y1="15" x2="21" y2="15"/><line x1="12" y1="20" x2="21" y2="20"/></svg> },
                        ] as const;
                        const active = alignOptions.find(o => o.cmd === currentAlign) ?? alignOptions[0];
                        return (
                          <div style={{ position: 'relative' }}>
                            <div
                              className="format-bar-btn"
                              title="Alineación"
                              onMouseDown={e => { e.preventDefault(); setShowAlignDropdown(p => !p); setShowFontDropdown(false); setShowSizeDropdown(false); }}
                              style={{ gap: 3 }}
                            >
                              {active.svg}
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                            </div>
                            {showAlignDropdown && (
                              <div style={{
                                position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
                                background: '#1a1f35', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                display: 'flex', flexDirection: 'column', zIndex: 700,
                              }}>
                                {alignOptions.map(({ cmd, title, svg }) => (
                                  <div
                                    key={cmd}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand(cmd); setComposeBody(previewDivRef.current.innerHTML); }
                                      setCurrentAlign(cmd);
                                      setShowAlignDropdown(false);
                                    }}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8,
                                      padding: '7px 12px', cursor: 'pointer', fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)',
                                      background: currentAlign === cmd ? 'rgba(165,180,252,0.15)' : 'transparent',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = currentAlign === cmd ? 'rgba(165,180,252,0.15)' : 'transparent')}
                                  >
                                    {svg}<span>{title}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Lista numerada */}
                      <div className="format-bar-btn" title="Lista numerada"
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('insertOrderedList'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
                      </div>

                      {/* Lista viñetas */}
                      <div className="format-bar-btn" title="Lista con viñetas"
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('insertUnorderedList'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                      </div>

                      <div className="format-bar-sep" />

                      {/* Tachado */}
                      <div className="format-bar-btn" title="Tachado" style={{ textDecoration: 'line-through' }}
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('strikeThrough'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >S</div>

                      {/* Quitar formato */}
                      <div className="format-bar-btn" title="Quitar formato"
                        onMouseDown={e => { e.preventDefault(); if (previewDivRef.current) { previewDivRef.current.focus(); document.execCommand('removeFormat'); setComposeBody(previewDivRef.current.innerHTML); } }}
                      >
                        <Paintbrush size={13} />
                      </div>
                </div>
              )}

              {attachments.length > 0 && (
                <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.1)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '7px 14px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, background: '#161b2e' }}>
                  <span style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 600, alignSelf: 'center', marginRight: 2, whiteSpace: 'nowrap', letterSpacing: '0.03em' }}>ADJUNTOS</span>
                  <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />
                  {attachments.map((file, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(165,180,252,0.1)', border: '1px solid rgba(165,180,252,0.25)', borderRadius: 20, padding: '4px 10px 4px 8px', fontSize: '0.73rem', color: 'rgba(255,255,255,0.9)', cursor: 'pointer' }}
                      onClick={() => { setPreviewFile(file); setPreviewFileName(file.name); }}
                      title="Clic para previsualizar"
                    >
                      <Paperclip size={10} style={{ color: '#a5b4fc', flexShrink: 0 }} />
                      <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0, fontSize: '0.66rem' }}>{(file.size / 1024).toFixed(0)}KB</span>
                      <span
                        onClick={e => { e.stopPropagation(); setAttachments(prev => prev.filter((_, j) => j !== i)); }}
                        style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', marginLeft: 2, fontSize: '0.75rem', lineHeight: 1 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                      >✕</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="composer-footer-toolbar">
                <div className="toolbar-left-side">
                  <button type="submit" disabled={isSendingCompose} className="btn btn-primary btn-send-gmail">
                    <span>{isSendingCompose ? 'Enviando...' : 'Enviar'}</span>
                    {isSendingCompose
                      ? <RefreshCw size={12} className="sync-icon spinning" />
                      : <Send size={12} />
                    }
                  </button>


                  <div className="editor-style-buttons">

                    {/* Botón tipografía — oculto en modo HTML crudo */}
                    <div
                      className="style-btn"
                      title="Formato de texto"
                      onClick={() => {
                        setShowTypographyPopover(p => !p);
                        setShowLinkPopover(false);
                      }}
                      style={{
                        color: showTypographyPopover ? '#a5b4fc' : undefined,
                        background: showTypographyPopover ? 'rgba(165,180,252,0.15)' : undefined,
                        borderRadius: showTypographyPopover ? '6px' : undefined,
                        outline: showTypographyPopover ? '1px solid rgba(165,180,252,0.4)' : undefined,
                        opacity: (isHtmlMode && composeViewMode === 'raw') ? 0.3 : 1,
                        pointerEvents: (isHtmlMode && composeViewMode === 'raw') ? 'none' : undefined,
                      }}
                    >
                      <Type size={14} />
                    </div>

                  {/* ENLACE */}
                  <div style={{ position: 'relative', opacity: (isHtmlMode && composeViewMode === 'raw') ? 0.3 : 1, pointerEvents: (isHtmlMode && composeViewMode === 'raw') ? 'none' : undefined }}>
                    <div
                      className="style-btn"
                      title="Insertar enlace"
                      onMouseDown={e => {
                        e.preventDefault(); // evita que el contentEditable pierda foco y selección
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) savedLinkSelection.current = sel.getRangeAt(0).cloneRange();
                        setShowLinkPopover(p => !p);
                        setShowTypographyPopover(false);
                      }}
                      style={{ color: showLinkPopover ? '#a5b4fc' : undefined }}
                    >
                      <Link size={14} />
                    </div>
                    {showLinkPopover && (
                      <div className="composer-popover" style={{ left: 0, bottom: '100%', marginBottom: 6, width: 260 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>URL del enlace</div>
                        <input
                          autoFocus
                          type="text"
                          value={linkUrl}
                          onChange={e => setLinkUrl(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (savedLinkSelection.current && previewDivRef.current) {
                                previewDivRef.current.focus();
                                const sel = window.getSelection();
                                sel?.removeAllRanges();
                                sel?.addRange(savedLinkSelection.current);
                                document.execCommand('createLink', false, linkUrl);
                                previewDivRef.current.querySelectorAll('a').forEach(a => a.setAttribute('target', '_blank'));
                                setComposeBody(previewDivRef.current.innerHTML);
                              }
                              setShowLinkPopover(false);
                              setLinkUrl('https://');
                            }
                            if (e.key === 'Escape') setShowLinkPopover(false);
                          }}
                          placeholder="https://..."
                          style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: 6,
                            color: 'white',
                            padding: '6px 10px',
                            fontSize: '0.8rem',
                            outline: 'none',
                          }}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>Pulsa Enter para confirmar · Esc para cancelar</div>
                      </div>
                    )}
                  </div>

                  {/* FIRMA */}
                  {mailboxSignatures[composeFrom] && (
                    <div
                      className="style-btn"
                      title={signatureInserted ? 'Quitar firma' : 'Insertar firma'}
                      onClick={() => {
                        const sig = mailboxSignatures[composeFrom];
                        if (!sig) return;
                        if (signatureInserted) {
                          if (previewDivRef.current) {
                            previewDivRef.current.innerHTML = previewDivRef.current.innerHTML.replace(`<br>${sig}`, '').replace(`<br/>${sig}`, '').replace(sig, '');
                            setComposeBody(previewDivRef.current.innerHTML);
                          } else {
                            setComposeBody(prev => prev.replace(`\n\n${sig}`, '').replace(sig, ''));
                          }
                          setSignatureInserted(false);
                        } else {
                          if (previewDivRef.current) {
                            previewDivRef.current.innerHTML += `<br/>${sig}`;
                            setComposeBody(previewDivRef.current.innerHTML);
                          } else {
                            setComposeBody(prev => prev + `\n\n${sig}`);
                          }
                          setSignatureInserted(true);
                        }
                      }}
                      style={{
                        opacity: (isHtmlMode && composeViewMode === 'raw') ? 0.3 : 1,
                        pointerEvents: (isHtmlMode && composeViewMode === 'raw') ? 'none' : undefined,
                        color: signatureInserted ? '#a5b4fc' : undefined,
                        background: signatureInserted ? 'rgba(165,180,252,0.15)' : undefined,
                        borderRadius: signatureInserted ? '6px' : undefined,
                        outline: signatureInserted ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      }}
                    >
                      <PenLine size={14} />
                    </div>
                  )}

                  <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)', margin: '0 2px' }} />

                  <div className="style-btn" title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip size={14} />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    style={{ display: 'none' }}
                    onChange={() => {
                      const files = fileInputRef.current?.files;
                      if (files && files.length > 0) {
                        setAttachments(prev => [...prev, ...Array.from(files)]);
                      }
                      setTimeout(() => { if (fileInputRef.current) fileInputRef.current.value = ''; }, 0);
                    }}
                  />
                  <div className="style-btn" title="Programar envío" onClick={() => showToast('Simulado: Programar envío', 'info')}>
                    <Clock size={14} />
                  </div>
                  <div
                    className="style-btn"
                    title={isHtmlMode ? 'Desactivar modo HTML' : 'Activar modo HTML (plantilla corporativa)'}
                    onClick={() => {
                      setIsHtmlMode(p => !p);
                      setComposeViewMode('preview');
                    }}
                    style={{
                      color: isHtmlMode ? '#a5b4fc' : undefined,
                      background: isHtmlMode ? 'rgba(165,180,252,0.15)' : undefined,
                      borderRadius: isHtmlMode ? '6px' : undefined,
                      outline: isHtmlMode ? '1px solid rgba(165,180,252,0.4)' : undefined,
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      padding: '2px 5px',
                    }}
                  >
                    HTML
                  </div>
                  {isHtmlMode && (
                    <div
                      className="style-btn"
                      title={composeViewMode === 'raw' ? 'Volver al editor visual' : 'Ver HTML en crudo'}
                      onClick={() => setComposeViewMode(prev => prev === 'raw' ? 'preview' : 'raw')}
                      style={{ color: composeViewMode === 'raw' ? '#a5b4fc' : undefined }}
                    >
                      {composeViewMode === 'raw' ? <Eye size={14} /> : <Code2 size={14} />}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PREVIEW ADJUNTO */}
      {previewFile && (() => {
        const url = URL.createObjectURL(previewFile);
        const isImage = previewFile.type.startsWith('image/');
        const isPdf = previewFile.type === 'application/pdf';
        return (
          <div
            onClick={() => setPreviewFile(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: '#1a1f35', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)', width: '90vw', maxWidth: 960, height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 320 }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <Paperclip size={14} style={{ color: '#a5b4fc', flexShrink: 0 }} />
                  <input
                    value={previewFileName}
                    onChange={e => setPreviewFileName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const renamed = new File([previewFile], previewFileName, { type: previewFile.type, lastModified: previewFile.lastModified });
                        setAttachments(prev => prev.map(f => f === previewFile ? renamed : f));
                        setPreviewFile(renamed);
                      }
                      if (e.key === 'Escape') setPreviewFileName(previewFile.name);
                    }}
                    onBlur={() => {
                      if (previewFileName !== previewFile.name) {
                        const renamed = new File([previewFile], previewFileName, { type: previewFile.type, lastModified: previewFile.lastModified });
                        setAttachments(prev => prev.map(f => f === previewFile ? renamed : f));
                        setPreviewFile(renamed);
                      }
                    }}
                    style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '4px 8px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(165,180,252,0.5)')}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{(previewFile.size / 1024).toFixed(0)} KB</span>
                </div>
                <div
                  onClick={() => setPreviewFile(null)}
                  style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem', lineHeight: 1, padding: 4, flexShrink: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >✕</div>
              </div>
              {/* Content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                {isImage && <img src={url} alt={previewFile.name} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, objectFit: 'contain', display: 'block' }} />}
                {isPdf && <iframe src={url} title={previewFile.name} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8 }} />}
                {!isImage && !isPdf && (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: 32 }}>
                    <Paperclip size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <div style={{ fontSize: '0.85rem' }}>{previewFile.name}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 4 }}>{previewFile.type || 'Tipo desconocido'} · {(previewFile.size / 1024).toFixed(0)} KB</div>
                    <div style={{ fontSize: '0.75rem', marginTop: 12, color: 'rgba(255,255,255,0.3)' }}>Vista previa no disponible para este tipo de archivo</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL CREAR NUEVA ETIQUETA */}
      {isNewLabelModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)'
        }}>
          <div className="glass-card" style={{
            width: '400px',
            background: '#131826',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px 0 rgba(139, 92, 246, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'white' }}>Nueva Etiqueta</h3>
              <button 
                type="button"
                onClick={() => setIsNewLabelModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-darker)', cursor: 'pointer', padding: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateLabel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Nombre de la etiqueta</label>
                <input 
                  type="text" 
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Ej: Pendiente, Urgente, Cliente..."
                  required
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    color: 'white',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-light)' }}>Color de la etiqueta</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {[
                    '#ef4444', // Rojo
                    '#3b82f6', // Azul
                    '#10b981', // Verde
                    '#f59e0b', // Amarillo/Naranja
                    '#8b5cf6', // Morado
                    '#ec4899', // Rosa
                    '#06b6d4', // Cyan
                    '#6b7280'  // Gris
                  ].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewLabelColor(color)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: color,
                        border: newLabelColor === color ? '3px solid white' : 'none',
                        cursor: 'pointer',
                        transform: newLabelColor === color ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.1s ease',
                        boxShadow: newLabelColor === color ? '0 0 8px rgba(255,255,255,0.4)' : 'none'
                      }}
                    />
                  ))}

                  {/* Selector de color libre arcoíris */}
                  <div style={{
                    position: 'relative',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: !['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'].includes(newLabelColor) ? '3px solid white' : 'none',
                    transform: !['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'].includes(newLabelColor) ? 'scale(1.1)' : 'scale(1)',
                    boxShadow: !['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6b7280'].includes(newLabelColor) ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                    transition: 'transform 0.1s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '100%',
                      height: '100%',
                      background: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)'
                    }} />
                    <input 
                      type="color" 
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer',
                        border: 'none',
                        padding: 0
                      }}
                      title="Color personalizado"
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewLabelModalOpen(false)}
                  className="btn btn-outline"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-light)'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                    border: 'none',
                    color: 'white'
                  }}
                >
                  Crear Etiqueta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .gmail-interface {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100vh;
        }
        .gmail-interface.settings-mode {
          height: auto;
          min-height: 100vh;
        }
        
        /* HEADER */
        .gmail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 20px;
          height: 64px;
          gap: 16px;
        }

        /* SELECTOR DE BUZÓN */
        .mailbox-switcher {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 3px;
          flex-shrink: 0;
        }
        .mailbox-pill {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 0.75rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 7px;
          cursor: pointer;
          transition: all var(--transition-fast);
          white-space: nowrap;
        }
        .mailbox-pill:hover {
          color: var(--text-main);
          background: rgba(255,255,255,0.04);
        }
        .mailbox-pill.active {
          background: rgba(139,92,246,0.15);
          color: var(--primary-light);
          border: 1px solid rgba(139,92,246,0.25);
        }
        .mailbox-pill-all {
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.7;
        }
        .mailbox-pill-all.active { opacity: 1; }
        .mailbox-settings-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 5px 7px;
          border-radius: 7px;
          display: flex;
          align-items: center;
          margin-left: 2px;
          transition: all var(--transition-fast);
        }
        .mailbox-settings-btn:hover { color: var(--text-main); background: rgba(255,255,255,0.06); }

        /* MODAL FIRMAS */
        .signature-modal {
          background: var(--surface-glass);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          width: 960px;
          max-width: 95vw;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }
        .signature-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          border-bottom: 1px solid var(--border-color);
        }
        .signature-modal-header h3 { font-size: 1rem; font-weight: 700; margin: 0; }
        .signature-modal-body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        .sig-mailbox-list {
          width: 200px;
          flex-shrink: 0;
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .sig-mailbox-item {
          background: transparent;
          border: none;
          border-radius: 8px;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          position: relative;
          transition: background var(--transition-fast);
        }
        .sig-mailbox-item:hover { background: rgba(255,255,255,0.04); }
        .sig-mailbox-item.active { background: rgba(139,92,246,0.12); }
        .sig-mailbox-label { font-size: 0.78rem; font-weight: 600; color: var(--text-main); }
        .sig-mailbox-email { font-size: 0.68rem; color: var(--text-muted); }
        .sig-has-dot {
          position: absolute; top: 8px; right: 8px;
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--primary-light);
        }
        .sig-editor-area {
          flex: 1;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .sig-editor-title { font-size: 0.9rem; font-weight: 700; margin: 0; }
        .sig-editor-email { font-size: 0.75rem; color: var(--text-muted); margin: 2px 0 0; }
        .sig-editor-hint { font-size: 0.72rem; color: var(--text-muted); margin: 0; }
        .sig-editor-split {
          display: flex;
          gap: 20px;
          flex: 1;
          min-height: 280px;
          align-items: stretch;
        }
        .sig-editor-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sig-preview-pane {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pane-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .sig-preview-content {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 14px;
          overflow-y: auto;
          color: var(--text-main);
          font-size: 0.85rem;
          min-height: 180px;
        }
        .placeholder-text-preview {
          color: var(--text-darker);
          font-style: italic;
          font-size: 0.8rem;
        }
        .sig-textarea {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-main);
          font-family: monospace;
          font-size: 0.82rem;
          padding: 12px 14px;
          resize: vertical;
          outline: none;
          line-height: 1.6;
          transition: border var(--transition-fast);
        }
        .sig-textarea:focus { border-color: var(--primary); }
        .sig-editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding-top: 4px;
        }
        .search-box-wrap {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          border-radius: 28px;
          padding: 8px 16px;
          width: 100%;
          max-width: 600px;
          position: relative;
          transition: border-color var(--transition-fast), background var(--transition-fast);
        }
        .search-box-wrap:focus-within {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--primary);
        }
        .search-icon {
          color: var(--text-darker);
          margin-right: 12px;
        }
        .gmail-search-input {
          background: transparent;
          border: none;
          color: white;
          outline: none;
          width: 100%;
          font-size: 0.9rem;
          font-family: var(--font-sans);
        }
        .filter-icon {
          color: var(--text-darker);
          cursor: pointer;
          margin-left: 8px;
          transition: color 0.2s;
          display: flex;
          align-items: center;
        }
        .filter-icon:hover {
          color: white;
        }
        .header-actions {
          display: flex;
          align-items: center;
        }
        .sync-icon {
          animation: spin-hover 2s linear infinite;
          animation-play-state: paused;
        }
        .sync-icon.spinning {
          animation-play-state: running !important;
        }
        .btn-icon:hover .sync-icon {
          animation-play-state: running !important;
        }

        /* WIDGET DE SYNC UNIFICADO */
        .sync-widget {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        /* BOTÓN PRINCIPAL: dot + icono + label + countdown */
        .sync-main-btn {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          min-width: 210px;
          height: 36px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 7px 12px;
          border-radius: 10px;
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
          white-space: nowrap;
        }
        .sync-main-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.07);
          color: var(--text-main);
          border-color: rgba(255,255,255,0.12);
        }
        .sync-main-btn:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }
        /* Estados del botón */
        .sync-main-btn.sync-btn-state.ok {
          border-color: rgba(52, 211, 153, 0.25);
          color: var(--text-muted);
        }
        .sync-main-btn.sync-btn-state.ok:hover:not(:disabled) {
          border-color: rgba(52, 211, 153, 0.45);
          color: var(--text-main);
        }
        .sync-main-btn.sync-btn-state.error {
          border-color: rgba(239, 68, 68, 0.3);
          color: var(--danger-light, #f87171);
        }
        .sync-main-btn.sync-btn-state.loading {
          border-color: rgba(139, 92, 246, 0.3);
          color: var(--primary-light);
        }

        /* Grupo izquierdo: icono + label */
        .sync-btn-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sync-btn-label {}

        /* Countdown / badge de estado dentro del botón */
        .sync-countdown-inline {
          font-size: 0.72rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          padding: 1px 7px;
          border-radius: 6px;
          letter-spacing: 0.03em;
          min-width: 44px;
          text-align: center;
          transition: background 0.3s, border-color 0.3s, color 0.3s;
          /* estado por defecto (idle) */
          color: var(--text-darker);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .sync-countdown-inline.status-ok {
          color: var(--success-light, #34d399);
          background: rgba(52, 211, 153, 0.1);
          border-color: rgba(52, 211, 153, 0.3);
        }
        .sync-countdown-inline.status-loading {
          color: var(--primary-light);
          background: rgba(139, 92, 246, 0.08);
          border-color: rgba(139, 92, 246, 0.2);
        }
        .sync-countdown-inline.status-error {
          color: var(--danger-light, #f87171);
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.25);
        }
        .sync-countdown-inline.status-idle {
          color: var(--text-darker);
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.08);
        }

        /* Última actualización — muy fino debajo */
        .sync-last-update {
          font-size: 0.62rem;
          font-weight: 400;
          color: var(--text-darker);
          letter-spacing: 0.02em;
          text-align: right;
          line-height: 1;
          opacity: 0.75;
        }

        /* Dot pulsante */
        .sync-pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          animation: pulse-dot 1.5s ease-in-out infinite;
          background: var(--primary-light);
        }
        .sync-pulse-dot.green {
          background: var(--success-light, #34d399);
          animation: pulse-dot-green 2.5s ease-in-out infinite;
        }
        .sync-pulse-dot.red {
          background: var(--danger-light, #f87171);
          animation: none;
        }
        @keyframes spin-hover {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes pulse-dot-green {
          0%, 100% { opacity: 0.8; box-shadow: 0 0 0 0 rgba(52,211,153,0.4); }
          50% { opacity: 1; box-shadow: 0 0 0 4px rgba(52,211,153,0); }
        }
        .sync-btn-state.loading {
          opacity: 0.7;
          pointer-events: none;
        }

        /* LAYOUT */
        .gmail-body-layout {
          display: flex;
          gap: 20px;
          flex: 1;
          height: calc(100% - 84px);
          overflow: hidden;
        }
        .gmail-body-layout.settings-mode {
          height: auto;
          overflow: visible;
        }

        /* SIDEBAR DE CARPETAS */
        .gmail-sidebar {
          width: 220px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .btn-compose-gmail {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(59,130,246,0.1) 100%);
          border: 1px solid rgba(139, 92, 246, 0.3);
          color: white;
          font-weight: 700;
          font-size: 0.9rem;
          padding: 14px 20px;
          border-radius: 16px;
          cursor: pointer;
          transition: all var(--transition-fast);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        .btn-compose-gmail:hover {
          transform: translateY(-1px);
          background: linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(59,130,246,0.2) 100%);
          border-color: var(--primary-light);
          box-shadow: var(--shadow-glow);
        }
        .folders-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .folder-item {
          display: flex;
          align-items: center;
          background: transparent;
          border: none;
          color: var(--text-muted);
          padding: 10px 14px;
          border-radius: 20px;
          cursor: pointer;
          font-family: var(--font-sans);
          font-size: 0.85rem;
          font-weight: 500;
          transition: all var(--transition-fast);
          width: 100%;
        }
        .folder-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-main);
        }
        .folder-item.active {
          background: rgba(139, 92, 246, 0.12);
          color: var(--primary-light);
          font-weight: 700;
        }
        .folder-label {
          margin-left: 12px;
          flex: 1;
          text-align: left;
        }
        .folder-count {
          font-size: 0.75rem;
          background: rgba(139, 92, 246, 0.2);
          color: var(--primary-light);
          padding: 1px 8px;
          border-radius: 100px;
          font-weight: 700;
        }
        
        .quick-tags-section {
          border-top: 1px solid var(--border-color);
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .tags-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-darker);
          padding-left: 10px;
        }
        .tag-items {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .tag-badge-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          color: var(--text-muted);
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .tag-badge-item:hover {
          background: rgba(255, 255, 255, 0.02);
          color: white;
        }
        .tag-badge-item.active {
          background: rgba(255, 255, 255, 0.04);
          color: white;
          font-weight: 600;
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot-primary { background-color: var(--secondary); }
        .dot-success { background-color: var(--success); }
        .dot-warning { background-color: var(--warning); }
        .dot-all { background-color: var(--text-darker); }

        /* CONTENEDOR CENTRAL */
        .gmail-content-area:hover {
          background: rgba(14, 18, 29, 0.35);
          border-color: var(--border-color);
          box-shadow: none;
        }
        .gmail-content-area {
          flex: 1;
          padding: 0;
          overflow-y: auto;
          overflow-x: hidden;
          background: rgba(14, 18, 29, 0.35);
          height: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .gmail-content-area.email-open {
          overflow: hidden;
        }
        .gmail-content-area.settings-mode {
          overflow: visible;
          height: auto;
        }

        /* LISTA DE CORREOS */
        .email-list-view {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .list-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-color);
          height: 48px;
        }
        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .btn-checkbox {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }
        .btn-checkbox:hover {
          color: var(--text-muted);
        }
        .toolbar-batch-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          border-left: 1px solid var(--border-color);
          padding-left: 14px;
        }
        .btn-toolbar-action {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: background 0.2s, color 0.2s;
        }
        .btn-toolbar-action:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }
        .selected-counter {
          font-size: 0.75rem;
          color: var(--primary-light);
          font-weight: 600;
        }
        .page-indicator {
          font-size: 0.75rem;
          color: var(--text-darker);
        }

        /* Pestañas de categoría */
        .category-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
        }
        .category-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: var(--text-muted);
          font-family: var(--font-sans);
          font-size: 0.8rem;
          font-weight: 600;
          padding: 12px 10px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .category-tab:hover {
          background: rgba(255, 255, 255, 0.01);
          color: white;
        }
        .category-tab.active {
          color: white;
          border-bottom-color: var(--primary);
          background: rgba(139, 92, 246, 0.03);
        }

        .emails-scroll-area {
          flex: 1;
          overflow-y: auto;
        }
        .empty-mailbox {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px;
          height: 60%;
          color: var(--text-muted);
        }
        
        /* FILAS DE CORREO */
        .email-row-item {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          user-select: none;
          transition: background 0.15s, border-color 0.15s;
          min-height: 42px;
        }
        .email-row-item:hover {
          background: rgba(255, 255, 255, 0.03);
          box-shadow: inset 2px 0 0 var(--primary);
        }
        .email-row-item.unread {
          background: rgba(139, 92, 246, 0.02);
          font-weight: 700;
        }
        .email-row-item.unread .sender-name,
        .email-row-item.unread .email-subject {
          color: white;
        }
        .email-row-item.selected {
          background: rgba(139, 92, 246, 0.05);
        }
        .email-item-checkbox {
          color: var(--text-darker);
          margin-right: 12px;
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        .email-item-checkbox:hover {
          color: var(--text-muted);
        }
        .email-item-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-right: 16px;
        }
        .action-btn-star {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .action-btn-star:hover {
          color: var(--warning);
        }
        .action-btn-star.starred {
          color: var(--warning);
        }
        .action-btn-important {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .action-btn-important:hover {
          color: var(--primary-light);
        }
        .action-btn-important.important {
          color: var(--primary-light);
        }
        
        .email-item-sender {
          width: 200px;
          min-width: 200px;
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
          font-size: 0.85rem;
          color: var(--text-muted);
          padding-right: 10px;
        }
        .sender-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .email-row-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.7rem;
          color: white;
          overflow: hidden;
          flex-shrink: 0;
        }
        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .avatar-text {
          font-size: 0.7rem;
          font-weight: 700;
        }
        .email-item-content {
          flex: 1;
          display: flex;
          align-items: center;
          overflow: hidden;
          white-space: nowrap;
          font-size: 0.85rem;
          padding-right: 15px;
        }
        .email-subject {
          color: var(--text-main);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .email-separator {
          color: var(--text-darker);
          margin: 0 4px;
        }
        .email-snippet {
          color: var(--text-muted);
          font-weight: 400;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .email-item-attachment-icon {
          display: flex;
          align-items: center;
          margin-right: 14px;
        }
        .email-item-tracking-icon {
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .email-item-tracking-icon:hover {
          transform: scale(1.25);
        }
        .email-item-tracking-icon:hover svg.text-muted {
          opacity: 1 !important;
          color: var(--text-light) !important;
          filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
        }
        .email-item-tracking-icon:hover svg.text-success-light {
          filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.7));
        }
        .email-item-date {
          font-size: 0.75rem;
          color: var(--text-darker);
          min-width: 50px;
          text-align: right;
        }

        /* DETALLE DE CORREO — layout Gmail */
        .email-detail-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .email-body-scroll {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          background: #f5f5f0;
        }

        /* Toolbar superior estilo Gmail */
        .gm-detail-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-color);
          position: sticky;
          top: 0;
          background: rgba(14,18,29,0.97);
          backdrop-filter: blur(8px);
          z-index: 10;
          gap: 4px;
        }
        .gm-toolbar-left, .gm-toolbar-right {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .gm-toolbar-sep {
          width: 1px;
          height: 20px;
          background: var(--border-color);
          margin: 0 6px;
        }
        .gm-toolbar-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }
        .gm-toolbar-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          color: white;
        }
        .gm-toolbar-btn:disabled { opacity: 0.3; cursor: default; }
        .gm-toolbar-btn.gm-active { color: var(--primary-light); }
        .gm-toolbar-btn.gm-starred { color: #facc15; }
        .gm-toolbar-btn.gm-danger:hover:not(:disabled) { color: var(--danger-light); }
        .gm-nav-count {
          font-size: 0.78rem;
          color: var(--text-muted);
          padding: 0 8px;
          white-space: nowrap;
        }

        /* Asunto estilo Gmail */
        .gm-subject-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          flex-wrap: wrap;
          padding: 20px 24px 12px;
        }
        .gm-subject-title {
          font-size: 1.4rem;
          font-weight: 700;
          color: white;
          margin: 0;
          line-height: 1.3;
        }

        /* Remitente estilo Gmail */
        .gm-sender-row {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 8px 24px 16px;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 0;
        }
        .gm-sender-avatar {
          width: 40px;
          height: 40px;
          min-width: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          color: white;
          overflow: hidden;
        }
        .gm-sender-info {
          flex: 1;
          min-width: 0;
        }
        .gm-sender-top {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .gm-sender-name {
          font-weight: 600;
          color: white;
          font-size: 0.9rem;
        }
        .gm-sender-email {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .gm-sender-bottom {
          font-size: 0.78rem;
          color: var(--text-darker);
          margin-top: 2px;
        }
        .gm-sender-actions {
          display: flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .gm-timestamp {
          font-size: 0.78rem;
          color: var(--text-darker);
          white-space: nowrap;
          margin-right: 6px;
        }

        /* Footer pie de correo estilo Gmail */
        .gm-footer-actions {
          display: flex;
          gap: 10px;
          padding: 16px 24px;
          background: rgba(14, 18, 29, 0.97);
          backdrop-filter: blur(8px);
          border-top: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .gm-footer-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 20px;
          border-radius: 20px;
          border: 1px solid var(--border-hover);
          background: transparent;
          color: var(--text-main);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }
        .gm-footer-btn:hover {
          background: rgba(255,255,255,0.06);
        }
        .detail-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .btn-back-list {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 8px 14px;
          border-radius: 8px;
          font-family: var(--font-sans);
          font-size: 0.8rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-back-list:hover {
          background: rgba(255, 255, 255, 0.08);
        }
        .toolbar-actions-group {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        
        .detail-subject-wrap {
          margin-bottom: 24px;
        }
        .subject-line {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .subject-line h2 {
          font-size: 1.4rem;
          color: white;
        }

        .detail-sender-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 30px;
        }
        .sender-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.95rem;
          color: white;
          overflow: hidden;
        }
        .sender-details {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .sender-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sender-full-name {
          font-weight: 600;
          color: white;
          font-size: 0.9rem;
        }
        .sender-email {
          font-size: 0.75rem;
          color: var(--text-darker);
        }
        .recipient-meta {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .date-time-meta {
          font-size: 0.75rem;
          color: var(--text-darker);
        }

        .detail-body-text {
          font-size: 0.92rem;
          color: var(--text-main);
          line-height: 1.6;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 30px;
          margin-bottom: 24px;
          overflow-x: auto;
          word-break: break-word;
        }
        .detail-body-text * { color: var(--text-main) !important; }
        .detail-body-text a, .detail-body-text a * { color: #818cf8 !important; text-decoration: underline; cursor: pointer; }
        .detail-body-text a, .detail-body-text a * { color: #818cf8 !important; }
        .detail-body-text img { max-width: 100%; height: auto; }
        .detail-body-text hr { border-color: rgba(255,255,255,0.1) !important; }

        .detail-attachments-box {
          margin-bottom: 30px;
        }
        .attachments-title {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 12px;
          display: block;
        }
        .attachments-list {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .attachment-file-card {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .attachment-file-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--border-hover);
        }
        .file-meta {
          display: flex;
          flex-direction: column;
        }
        .file-name {
          font-size: 0.75rem;
          font-weight: 600;
          color: white;
        }
        .file-size {
          font-size: 0.65rem;
          color: var(--text-darker);
        }

        .detail-footer-reply {
          display: flex;
          margin-top: 10px;
        }

        /* COMPOSER FLOTANTE */
        .gmail-composer-floating {
          position: fixed;
          bottom: 0;
          right: 30px;
          width: 540px;
          height: 520px;
          display: flex;
          flex-direction: column;
          background: #111523;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px 12px 0 0;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6), var(--shadow-glow);
          z-index: 500;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .gmail-composer-floating.maximized {
          width: 800px;
          height: calc(100vh - 100px);
          right: 5%;
        }
        .composer-header {
          background: rgba(255, 255, 255, 0.03);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .composer-header span {
          font-size: 0.85rem;
          font-weight: 700;
          color: white;
        }
        .header-window-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .window-action-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.2s;
        }
        .window-action-btn:hover {
          color: white;
        }
        .window-action-btn.close-btn:hover {
          color: var(--danger-light);
        }

        .composer-form {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .composer-field {
          display: flex;
          align-items: center;
          padding: 8px 16px;
          gap: 10px;
          flex-shrink: 0;
        }
        .composer-field.border-bottom {
          border-bottom: 1px solid var(--border-color);
        }
        .field-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
          min-width: 40px;
        }
        .composer-input {
          background: transparent;
          border: none;
          color: white;
          font-family: var(--font-sans);
          font-size: 0.85rem;
          outline: none;
          width: 100%;
        }
        .composer-select {
          background: transparent;
          border: none;
          color: var(--primary-light);
          font-weight: 600;
          outline: none;
          font-size: 0.8rem;
          cursor: pointer;
        }
        .composer-select option {
          background-color: #111523;
          color: white;
        }
        
        .composer-body-area {
          flex: 1;
          padding: 16px;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: #f5f4f0;
        }
        .composer-textarea {
          background: #1e2235;
          border: none;
          color: #a8d8a8;
          font-family: 'Courier New', monospace;
          font-size: 0.82rem;
          outline: none;
          resize: none;
          width: 100%;
          flex: 1;
          line-height: 1.6;
          border-radius: 6px;
          padding: 12px;
          box-sizing: border-box;
        }

        .composer-footer-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-top: 1px solid var(--border-color);
        }
        .toolbar-left-side {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .btn-send-gmail {
          height: 38px;
          padding: 0 20px;
          border-radius: 20px;
          font-weight: 700;
          display: inline-flex;
          gap: 8px;
        }
        .editor-style-buttons {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .style-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 8px;
          border-radius: 6px;
          transition: background 0.2s, color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .style-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.05);
        }
        .style-btn.trash-btn:hover {
          color: var(--danger-light);
          background: rgba(239, 68, 68, 0.05);
        }
        .composer-popover {
          position: absolute;
          background: #1a1f35;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 12px;
          box-shadow: 0 12px 32px rgba(0,0,0,0.6);
          z-index: 600;
        }
        .popover-item {
          padding: 6px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.82rem;
          color: var(--text-muted);
          transition: background 0.15s, color 0.15s;
        }
        .popover-item:hover {
          background: rgba(255,255,255,0.06);
          color: white;
        }
        /* Barra de formato horizontal estilo Gmail */
        .composer-format-bar {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 12px;
          width: fit-content;
          display: flex;
          align-items: center;
          gap: 2px;
          background: #1a1f35;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 5px 8px;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.5);
          z-index: 600;
          flex-wrap: nowrap;
          overflow: visible;
        }
        .composer-format-bar::-webkit-scrollbar { display: none; }
        .composer-editor-content ul {
          list-style-type: disc;
          padding-left: 1.5em;
          margin: 0.25em 0;
        }
        .composer-editor-content ol {
          list-style-type: decimal;
          padding-left: 1.5em;
          margin: 0.25em 0;
        }
        .composer-editor-content li { margin: 0.1em 0; }
        .format-bar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 6px;
          border-radius: 5px;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.82rem;
          transition: background 0.15s, color 0.15s;
          position: relative;
          user-select: none;
        }
        .format-bar-btn:hover {
          background: rgba(255,255,255,0.07);
          color: white;
        }
        .format-bar-color-btn {
          overflow: visible;
        }
        .format-bar-select {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 5px;
          color: var(--text-light);
          font-size: 0.78rem;
          padding: 3px 6px;
          outline: none;
          cursor: pointer;
          height: 28px;
          max-width: 110px;
        }
        .format-bar-select option { background: #1a1f35; }
        .format-bar-select--sm { max-width: 52px; }
        .format-bar-sep {
          width: 1px;
          height: 18px;
          background: rgba(255,255,255,0.12);
          margin: 0 3px;
          flex-shrink: 0;
        }
        /* CAMPAIGNS VIEW */
        .campaigns-dashboard-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
          height: 100%;
          overflow-y: auto;
        }
        .campaign-kpis-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 16px;
          margin-bottom: 8px;
        }
        .campaign-kpis-header h3 {
          font-size: 1.25rem;
          color: white;
          margin-bottom: 4px;
        }
        .campaigns-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 10px;
        }
        .kpi-card-mini {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .kpi-val {
          font-size: 1.15rem;
          font-weight: 800;
          color: white;
          line-height: 1.1;
        }
        .kpi-lbl {
          font-size: 0.65rem;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
        }
        .campaign-name-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .camp-name-title {
          font-weight: 600;
          color: white;
        }
        .camp-subject-sub {
          font-size: 0.75rem;
        }
        .tag-target-badge {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          color: var(--primary-light);
          font-size: 0.75rem;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 500;
        }
        .progress-bar-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 100px;
        }
        .progress-bar-wrap .val {
          font-size: 0.75rem;
          font-weight: 700;
          color: white;
        }
        .progress-bar-bg {
          width: 100%;
          height: 4px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 2px;
        }
        .progress-bar-fill.success { background: var(--success); }
        .progress-bar-fill.info { background: var(--secondary); }

        /* WIZARD DE CAMPAÑAS */
        .campaign-wizard-view {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow-y: auto;
          padding: 24px;
        }
        .campaign-wizard-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 24px;
          flex: 1;
        }
        @media (max-width: 1024px) {
          .campaign-wizard-layout {
            grid-template-columns: 1fr;
          }
        }
        .campaign-wizard-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .date-input-wrap {
          position: relative;
        }
        .date-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
        }
        .date-input {
          padding-left: 36px;
        }
        .form-submit-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }
        
        .campaign-wizard-preview {
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
          min-height: 400px;
        }
        .preview-header-bar {
          background: rgba(255, 255, 255, 0.03);
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-color);
        }
        .preview-toggle-btns {
          display: flex;
          gap: 6px;
        }
        .preview-toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.2s, background 0.2s;
        }
        .preview-toggle-btn:hover {
          color: white;
        }
        .preview-toggle-btn.active {
          color: var(--primary-light);
          background: rgba(139, 92, 246, 0.1);
        }
        
        .preview-viewport-wrap {
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          flex: 1;
          overflow-y: auto;
          transition: all 0.3s;
        }
        .preview-viewport-wrap.mobile {
          background: rgba(0, 0, 0, 0.3);
        }
        .preview-viewport-wrap.mobile .preview-viewport-content {
          width: 320px;
          border-radius: 20px;
          border: 8px solid #333;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          height: 520px;
          overflow-y: auto;
        }
        .preview-viewport-content {
          background: white;
          color: #333;
          width: 100%;
          border-radius: 8px;
          font-size: 0.85rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          text-align: left;
        }
        .preview-email-header {
          background: #f7f9fc;
          padding: 12px 16px;
          border-bottom: 1px solid #e1e4e8;
          font-size: 0.75rem;
          color: #555;
        }
        .preview-email-header p {
          margin-bottom: 2px;
        }
        .preview-email-body {
          padding: 20px;
          line-height: 1.5;
          min-height: 200px;
        }
        .placeholder-text-preview {
          color: #aaa;
          text-align: center;
          margin-top: 60px;
          font-style: italic;
        }

        /* TEMPLATES VIEW */
        .templates-dashboard-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
          height: 100%;
          overflow: hidden;
        }
        .templates-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          flex: 1;
          height: calc(100% - 64px);
        }
        @media (max-width: 900px) {
          .templates-layout {
            grid-template-columns: 1fr;
          }
        }
        .templates-list-sidebar {
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
        }
        .sidebar-sub-title {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }
        .templates-items-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .template-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .template-item-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .template-item-row.active {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
        .template-item-meta-info {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .template-item-meta-info .item-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .template-name-label {
          font-size: 0.82rem;
          color: var(--text-main);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .template-item-row.active .template-name-label {
          color: var(--primary-light);
          font-weight: 600;
        }
        .template-delete-btn {
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s, background 0.2s;
        }
        .template-delete-btn:hover {
          color: var(--danger-light);
          background: rgba(239, 68, 68, 0.05);
        }
        
        .variable-hints-box {
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
        }
        .hints-header-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
          display: block;
        }
        .hints-variables {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .hints-variables li {
          font-size: 0.7rem;
          color: var(--text-darker);
        }
        .hints-variables code {
          background: rgba(255, 255, 255, 0.05);
          color: var(--primary-light);
          padding: 2px 4px;
          border-radius: 4px;
          font-family: monospace;
        }

        .template-editor-workspace {
          background: rgba(14, 18, 29, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 20px;
          overflow: hidden;
          display: grid;
          grid-template-columns: 1.2fr 1.1fr;
          gap: 20px;
          height: 100%;
        }
        .template-editor-inner-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          overflow-y: auto;
          padding-right: 8px;
        }
        .template-live-preview {
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
        }
        @media (max-width: 1200px) {
          .template-editor-workspace {
            grid-template-columns: 1fr;
            overflow-y: auto;
          }
          .template-live-preview {
            min-height: 450px;
          }
        }
        .editor-actions-row {
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
          margin-top: 8px;
        }


        /* PANEL DE RESPUESTA A CONTACTO */
        .contact-reply-panel {
          margin-top: 20px;
          background: rgba(139, 92, 246, 0.05);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeIn 0.3s ease-out;
        }
        .reply-panel-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.88rem;
          color: var(--text-muted);
        }
        .reply-panel-header strong {
          color: var(--text-main);
        }
        .reply-textarea {
          min-height: 120px;
          resize: vertical;
        }
        .reply-panel-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        /* BADGE DE RESPONDIDO */
        .replied-badge-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: rgba(52, 211, 153, 0.07);
          border: 1px solid rgba(52, 211, 153, 0.2);
          border-radius: 8px;
          font-size: 0.84rem;
          color: var(--success-light);
        }

        /* BADGE DE EMAIL REAL DE CONTACTO */
        .contact-real-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 100px;
          background: rgba(59, 130, 246, 0.12);
          color: var(--secondary-light, #60a5fa);
          border: 1px solid rgba(59, 130, 246, 0.2);
          margin-left: 6px;
          letter-spacing: 0.03em;
          vertical-align: middle;
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .modal-overlay {
          position: absolute;
          inset: 0;
          background: rgb(14, 18, 29);
          display: flex;
          align-items: stretch;
          justify-content: stretch;
          z-index: 10;
          animation: modal-fade-in 0.15s ease-out;
        }
        .email-detail-modal {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @keyframes modal-fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        /* TRACKING DASHBOARD STYLES */
        .tracking-dashboard-view {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
          height: 100%;
          overflow-y: auto;
        }
        .tracking-dashboard-view .tracking-kpi-grid {
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 768px) {
          .tracking-dashboard-view .tracking-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .table-row-hover {
          transition: background-color var(--transition-fast);
        }
        .table-row-hover:hover {
          background-color: rgba(255, 255, 255, 0.02) !important;
        }

        /* CUSTOM SELECT STYLES (ESTILO MANAGER) */
        .custom-select-container {
          position: relative;
          width: 100%;
          display: inline-block;
        }
        .custom-select-trigger {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(14, 18, 29, 0.4);
          border: 1px solid var(--border-color);
          color: white;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          outline: none;
          transition: all 0.2s ease;
          min-height: 36px;
        }
        .custom-select-trigger:hover:not(:disabled) {
          background: rgba(14, 18, 29, 0.6);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .custom-select-trigger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .custom-select-trigger-content {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }
        .custom-select-icon-left {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          color: var(--text-muted);
        }
        .custom-select-text-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .custom-select-arrow {
          color: var(--text-muted);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .custom-select-arrow.open {
          transform: rotate(180deg);
        }
        
        .custom-select-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          margin-top: 6px;
          background: rgba(17, 22, 34, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          max-height: 240px;
          overflow-y: auto;
          animation: select-fade-in 0.2s ease;
        }
        .custom-select-options-list {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .custom-select-option-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: none;
          color: var(--text-darker);
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
        }
        .custom-select-option-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }
        .custom-select-option-item.selected {
          background: rgba(139, 92, 246, 0.15);
          color: var(--primary-light);
          font-weight: 600;
        }
        .custom-select-option-content {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .custom-select-option-icon {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }
        .custom-select-option-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .custom-select-option-title {
          font-size: 0.82rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .custom-select-option-subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 1px;
        }
        .custom-select-selected-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary-light);
          flex-shrink: 0;
          margin-left: 8px;
        }

        @keyframes select-fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* TOASTS PREMIUM STYLES */
        .toasts-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          z-index: 9999;
          pointer-events: none;
        }
        .toast-item {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 280px;
          max-width: 420px;
          padding: 14px 18px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 1px rgba(255, 255, 255, 0.2) inset;
          color: white;
          font-size: 0.85rem;
          font-weight: 500;
          animation: toast-fade-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          position: relative;
          overflow: hidden;
        }
        .toast-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
        }
        .toast-item.success::before {
          background: var(--success, #10b981);
        }
        .toast-item.error::before {
          background: var(--error, #ef4444);
        }
        .toast-item.info::before {
          background: var(--primary, #6366f1);
        }
        .toast-item.success svg {
          color: var(--success-light, #34d399);
        }
        .toast-item.error svg {
          color: #f87171;
        }
        .toast-item.info svg {
          color: var(--primary-light, #a5b4fc);
        }
        .toast-close-btn {
          margin-left: auto;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }
        .toast-close-btn:hover {
          color: white;
          background: rgba(255, 255, 255, 0.08);
        }
        @keyframes toast-fade-in {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

    {/* Modal de Seguimiento */}
    {isTrackingModalOpen && trackingEmail?.tracking && (
      <div onClick={() => { setIsTrackingModalOpen(false); setTrackingEmail(null); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface-card, #111827)', border: '1px solid var(--border-color)', borderRadius: '16px', width: '100%', maxWidth: '560px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCheck size={18} style={{ color: 'var(--primary-light)' }} />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>Actividad de Seguimiento</h4>
              {trackingEmail.tracking.status === 'opened' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                  <CheckCheck size={11} /> ABIERTO
                </span>
              ) : trackingEmail.tracking.status === 'delivered' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                  <CheckCheck size={11} /> ENTREGADO
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                  <Check size={11} /> ENVIADO
                </span>
              )}
            </div>
            <button onClick={() => { setIsTrackingModalOpen(false); setTrackingEmail(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Estado de lectura */}
            <div>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Estado de Lectura</p>
              {trackingEmail.tracking.status === 'opened' ? (
                <div style={{ background: 'rgba(52, 211, 153, 0.03)', border: '1px solid rgba(52, 211, 153, 0.1)', padding: '16px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Primera apertura</span>
                    <strong style={{ fontSize: '0.83rem', color: 'var(--text-main)' }}>{trackingEmail.tracking.openedAt}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Última apertura</span>
                    {(() => {
                      const opens = trackingEmail.tracking.opens || [];
                      const lastOpen = opens.length > 0 ? opens[opens.length - 1] : null;
                      const lastOpenFormatted = lastOpen
                        ? formatDateTime(lastOpen.opened_at)
                        : trackingEmail.tracking.openedAt;
                      return <strong style={{ fontSize: '0.83rem', color: 'var(--text-main)' }}>{lastOpenFormatted}</strong>;
                    })()}
                  </div>
                  <div>
                    <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Total lecturas</span>
                    <strong style={{ fontSize: '0.83rem', color: 'var(--primary-light)' }}>{Math.max(1, (trackingEmail.tracking.opens || []).length)}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '12px' }}>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic', lineHeight: '1.4' }}>
                    {trackingEmail.tracking.status === 'delivered'
                      ? 'Entregado. El correo ha sido recibido en el servidor del destinatario, pero aún no lo ha abierto.'
                      : 'Enviado. El correo ha salido de nuestro servidor y está en tránsito.'}
                  </p>
                </div>
              )}
            </div>

            {/* Enlaces clicados */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Enlaces Clicados</p>
              {trackingEmail.tracking.clicks && trackingEmail.tracking.clicks.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {trackingEmail.tracking.clicks.map((click, i) => {
                    const firstClickFormatted = click.firstClickedAt
                      ? formatDateTime(click.firstClickedAt)
                      : 'Sin fecha';
                    const lastClickFormatted = click.lastClickedAt
                      ? formatDateTime(click.lastClickedAt)
                      : firstClickFormatted;

                    return (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                          <a href={click.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-light)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <ExternalLink size={12} style={{ flexShrink: 0 }} />
                            <span>{click.url}</span>
                          </a>
                          <span style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', flexShrink: 0 }}>
                            {click.clicksCount} {click.clicksCount === 1 ? 'clic' : 'clics'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                          <div>
                            <span>Primer clic:</span>{' '}
                            <strong style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>{firstClickFormatted}</strong>
                          </div>
                          <div>
                            <span>Último clic:</span>{' '}
                            <strong style={{ color: 'var(--text-main)', display: 'block', marginTop: '2px' }}>{lastClickFormatted}</strong>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ fontSize: '0.83rem', color: 'var(--text-darker)', margin: 0, fontStyle: 'italic' }}>Sin clics registrados.</p>
              )}
            </div>

            {/* Descargas */}
            {trackingEmail.tracking.downloads && trackingEmail.tracking.downloads.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>Descargas de Documentos</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {trackingEmail.tracking.downloads.map((dl, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem' }}>
                      <FileDown size={13} style={{ color: 'var(--warning)' }} />
                      <span style={{ fontWeight: 600, color: 'white' }}>{dl.fileName}</span>
                      <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{dl.downloadsCount}×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Toasts fuera del gmail-interface para evitar que transform del padre rompa position:fixed */}
    <div className="toasts-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast-item ${toast.type}`}>
          {toast.type === 'success' && <CheckCheck size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <Info size={16} />}
          <span>{toast.message}</span>
          <button className="toast-close-btn" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
    </>
  );

};

