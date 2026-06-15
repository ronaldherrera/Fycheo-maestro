export interface TrackingInfo {
  status: 'sent' | 'delivered' | 'opened';
  openedAt?: string;
  opens?: { opened_at: string }[];
  clicks?: { url: string; clicksCount: number; firstClickedAt?: string; lastClickedAt?: string }[];
  downloads?: { fileName: string; downloadsCount: number }[];
}

export interface Email {
  id: string;
  sender: string;
  senderEmail: string;
  recipient?: string;   // Destinatario del correo (para enviados)
  avatar: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  time: string;
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'campaigns';
  read: boolean;
  starred: boolean;
  important: boolean;
  category?: 'primary' | 'notifications' | 'system';
  cc?: string;
  bcc?: string;
  labels?: string[]; // IDs de etiquetas asignadas al correo
  attachments?: { name: string; size: number; type: string; url: string }[];
  avatarUrl?: string;
  // Campos para mensajes de contacto reales (Supabase contact_messages)
  _contactId?: string;  // ID original en Supabase
  isContact?: boolean;  // Si es un mensaje real de la tabla contact_messages
  // Campos para emails directos recibidos en hola@fycheo.es (tabla inbound_emails)
  _inboundId?: string;  // ID original en inbound_emails
  isInbound?: boolean;  // Si es un email directo recibido via Resend inbound
  replied?: boolean;    // Si ya fue respondido
  toEmail?: string;     // Buzón destinatario (para filtrar por cuenta)
  tracking?: TrackingInfo; // Información de seguimiento
  // Campos para emails enviados (tabla sent_emails)
  _sentId?: string;
  isSent?: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  target: string;
  sentDate: string;
  sentCount: number;
  openRate: number;
  clickRate: number;
  status: 'sent' | 'scheduled' | 'draft';
  content: string;
}

export interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
}

export interface MailboxLabel {
  id: string;
  name: string;
  color: string;
}
