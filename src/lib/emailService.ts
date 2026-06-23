import { supabase } from './supabase';
import { Email } from '../types';
import { formatDate } from './utils';

// ================================================================
// ENVÍO DE CORREOS VIA SMTP DE HOSTINGER (Edge Function send-email)
// ================================================================
export async function sendEmail(params: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string;
  bcc?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('send-email', {
    body: params,
  });
  if (error) return { success: false, error: error.message };
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

// ================================================================
// SINCRONIZACIÓN IMAP CON HOSTINGER (Edge Function sync-inbox)
// ================================================================
export async function syncInbox(): Promise<{ synced: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('sync-inbox');
  if (error) return { synced: 0, error: error.message };
  if (data?.error) return { synced: 0, error: data.error };
  return { synced: data?.synced ?? 0 };
}

// ================================================================
// INTERFAZ PARA MENSAJES DE CONTACTO (tabla contact_messages)
// ================================================================
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  message?: string;
  created_at: string;
  read: boolean;
  starred: boolean;
  important: boolean;
  replied: boolean;
  reply_body?: string;
  replied_at?: string;
}

// ================================================================
// CONVERSIÓN: contact_message → Email (tipo interno)
// ================================================================
export function contactMessageToEmail(msg: ContactMessage): Email {
  const date = new Date(msg.created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  let dateLabel: string;
  if (diffDays === 0) dateLabel = 'Hoy';
  else if (diffDays === 1) dateLabel = 'Ayer';
  else dateLabel = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const timeLabel = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const initials = msg.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const companyInfo = msg.company ? ` (${msg.company})` : '';
  const phoneInfo = msg.phone ? `<br/><strong>Teléfono:</strong> ${msg.phone}` : '';

  return {
    id: `contact_${msg.id}`,
    // Guardamos el ID original para actualizaciones en Supabase
    _contactId: msg.id,
    sender: msg.name + companyInfo,
    senderEmail: msg.email,
    avatar: initials,
    subject: msg.company
      ? `Mensaje de contacto – ${msg.company}`
      : `Mensaje de contacto – ${msg.name}`,
    snippet: (msg.message ?? '').substring(0, 100) + ((msg.message?.length ?? 0) > 100 ? '...' : ''),
    body: `<strong>De:</strong> ${msg.name}<br/>
<strong>Email:</strong> ${msg.email}${phoneInfo}${msg.company ? `<br/><strong>Empresa:</strong> ${msg.company}` : ''}<br/><br/>
<hr style="border:none;border-top:1px solid #333;margin:16px 0;"/>
${(msg.message ?? '').replace(/\n/g, '<br/>')}
${msg.replied ? `<br/><hr style="border:none;border-top:1px solid #2a2a4a;margin:16px 0;"/>
<div style="background:rgba(139,92,246,0.07);border-left:3px solid #8b5cf6;padding:12px 16px;border-radius:6px;margin-top:8px;">
  <p style="font-size:0.78rem;color:#8b5cf6;margin:0 0 6px;font-weight:600;">✅ RESPONDIDO (${formatDate(msg.replied_at)})</p>
  ${(msg.reply_body ?? '').replace(/\n/g, '<br/>')}
</div>` : ''}`,
    date: dateLabel,
    time: timeLabel,
    folder: 'inbox',
    read: msg.read,
    starred: msg.starred,
    important: msg.important,
    category: 'primary',
    isContact: true,
    replied: msg.replied,
  };
}

// ================================================================
// FETCH: Cargar todos los mensajes de contacto
// ================================================================
export async function fetchContactMessages(): Promise<Email[]> {
  const { data, error } = await supabase
    .from('contact_messages')
    .select('*')
    .is('trashed_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[emailService] Error al cargar contact_messages:', error.message);
    return [];
  }

  return (data as ContactMessage[]).map(contactMessageToEmail);
}

// ================================================================
// UPDATE: Marcar como leído
// ================================================================
export async function markContactRead(contactId: string, read: boolean): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ read })
    .eq('id', contactId);

  if (error) console.error('[emailService] Error al marcar leído:', error.message);
}

// ================================================================
// UPDATE: Marcar como destacado (estrella)
// ================================================================
export async function markContactStarred(contactId: string, starred: boolean): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ starred })
    .eq('id', contactId);

  if (error) console.error('[emailService] Error al marcar destacado:', error.message);
}

// ================================================================
// UPDATE: Marcar como importante
// ================================================================
export async function markContactImportant(contactId: string, important: boolean): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ important })
    .eq('id', contactId);

  if (error) console.error('[emailService] Error al marcar importante:', error.message);
}

// ================================================================
// UPDATE: Registrar respuesta enviada
// ================================================================
export async function markContactReplied(
  contactId: string,
  replyBody: string
): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({
      replied: true,
      reply_body: replyBody,
      replied_at: new Date().toISOString(),
    })
    .eq('id', contactId);

  if (error) console.error('[emailService] Error al guardar respuesta:', error.message);
}

// ================================================================
// DELETE: Eliminar mensaje de contacto
// ================================================================
export async function trashContactMessage(contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ trashed_at: new Date().toISOString() })
    .eq('id', contactId);
  if (error) console.error('[emailService] Error al mover a papelera:', error.message);
}

export async function deleteContactMessage(contactId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .delete()
    .eq('id', contactId);
  if (error) console.error('[emailService] Error al eliminar mensaje:', error.message);
}

// ================================================================
// INBOUND EMAILS (tabla inbound_emails — recibidos via Resend)
// ================================================================
export interface InboundEmail {
  id: string;
  created_at: string;
  from_name: string | null;
  from_email: string;
  to_email: string | null;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  read: boolean;
  starred: boolean;
  important: boolean;
  replied: boolean;
  reply_body?: string;
  replied_at?: string;
  sender_avatar?: string | null;
  attachments?: { name: string; size: number; type: string; url: string }[] | null;
  message_id?: string | null;
}

export function inboundEmailToEmail(msg: InboundEmail): Email {
  const date = new Date(msg.created_at);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  let dateLabel: string;
  if (diffDays === 0) dateLabel = 'Hoy';
  else if (diffDays === 1) dateLabel = 'Ayer';
  else dateLabel = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  const timeLabel = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const senderName = msg.from_name || msg.from_email;
  const initials = senderName
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');

  const bodyContent = msg.html_body
    ? msg.html_body
    : (msg.text_body ?? '').replace(/\n/g, '<br/>');

  return {
    id: `inbound_${msg.id}`,
    _inboundId: msg.id,
    sender: senderName,
    senderEmail: msg.from_email,
    avatar: initials,
    avatarUrl: msg.sender_avatar ?? undefined,
    subject: msg.subject ?? '(Sin asunto)',
    snippet: (msg.text_body ?? '').substring(0, 100) + ((msg.text_body?.length ?? 0) > 100 ? '...' : ''),
    body: bodyContent,
    date: dateLabel,
    time: timeLabel,
    folder: 'inbox',
    read: msg.read,
    starred: msg.starred,
    important: msg.important,
    category: 'primary',
    isInbound: true,
    replied: msg.replied,
    toEmail: msg.to_email ?? undefined,
    attachments: msg.attachments ?? undefined,
  };
}

export async function fetchInboundEmails(): Promise<Email[]> {
  const { data, error } = await supabase
    .from('inbound_emails')
    .select('*')
    .is('trashed_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[emailService] Error al cargar inbound_emails:', error.message);
    return [];
  }

  return (data as InboundEmail[]).map(inboundEmailToEmail);
}

export async function markInboundRead(id: string, read: boolean): Promise<void> {
  const { error } = await supabase.from('inbound_emails').update({ read }).eq('id', id);
  if (error) console.error('[emailService] Error markInboundRead:', error.message);
}

export async function markInboundStarred(id: string, starred: boolean): Promise<void> {
  const { error } = await supabase.from('inbound_emails').update({ starred }).eq('id', id);
  if (error) console.error('[emailService] Error markInboundStarred:', error.message);
}

export async function markInboundImportant(id: string, important: boolean): Promise<void> {
  const { error } = await supabase.from('inbound_emails').update({ important }).eq('id', id);
  if (error) console.error('[emailService] Error markInboundImportant:', error.message);
}

export async function markInboundReplied(id: string, replyBody: string): Promise<void> {
  const { error } = await supabase.from('inbound_emails').update({
    replied: true,
    reply_body: replyBody,
    replied_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('[emailService] Error markInboundReplied:', error.message);
}

export async function trashInboundEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('inbound_emails')
    .update({ trashed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[emailService] Error trashInboundEmail:', error.message);
}

export async function deleteInboundEmail(id: string): Promise<void> {
  const { error } = await supabase.from('inbound_emails').delete().eq('id', id);
  if (error) console.error('[emailService] Error deleteInboundEmail:', error.message);
}

// ================================================================
// SENT EMAILS (tabla sent_emails)
// ================================================================
export interface SentEmailRow {
  id: string;
  created_at: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  cc: string | null;
  bcc: string | null;
  subject: string | null;
  html_body: string | null;
  text_body: string | null;
  labels: string[] | null;
  starred: boolean;
  important: boolean;
  tracking_status: string;
  opened_at: string | null;
  opens_data: { opened_at: string }[] | null;
  clicks_data: { url: string; clicksCount: number; firstClickedAt?: string; lastClickedAt?: string }[] | null;
}

export async function saveSentEmail(params: {
  from_email: string;
  from_name: string;
  to_email: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html_body: string;
  text_body: string;
  labels?: string[];
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('sent_emails')
    .insert({
      from_email: params.from_email,
      from_name: params.from_name,
      to_email: params.to_email,
      cc: params.cc ?? null,
      bcc: params.bcc ?? null,
      subject: params.subject,
      html_body: params.html_body,
      text_body: params.text_body,
      labels: params.labels ?? [],
      tracking_status: 'sent',
    })
    .select('id')
    .single();

  if (error) {
    console.error('[emailService] Error al guardar sent_email:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function fetchSentEmails(): Promise<Email[]> {
  const { data, error } = await supabase
    .from('sent_emails')
    .select('*')
    .is('trashed_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[emailService] Error al cargar sent_emails:', error.message);
    return [];
  }

  return (data as SentEmailRow[]).map((row): Email => {
    const date = new Date(row.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const dateLabel = diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Ayer'
      : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const timeLabel = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    const initials = (row.from_name || row.from_email)
      .split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('');

    return {
      id: `sent_${row.id}`,
      _sentId: row.id,
      sender: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
      senderEmail: row.from_email,
      recipient: row.to_email,
      cc: row.cc ?? undefined,
      bcc: row.bcc ?? undefined,
      avatar: initials,
      subject: row.subject ?? '(Sin asunto)',
      snippet: (row.text_body ?? '').substring(0, 100),
      body: row.html_body ?? row.text_body ?? '',
      date: dateLabel,
      time: timeLabel,
      folder: 'sent',
      read: true,
      starred: row.starred,
      important: row.important,
      labels: row.labels ?? [],
      isSent: true,
      tracking: {
        status: row.tracking_status as 'sent' | 'delivered' | 'opened',
        openedAt: row.opened_at ? new Date(row.opened_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined,
        opens: (row.opens_data as { opened_at: string }[] | null) ?? [],
        clicks: row.clicks_data ?? [],
        downloads: [],
      },
    };
  });
}

export async function trashSentEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('sent_emails')
    .update({ trashed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[emailService] Error trashSentEmail:', error.message);
}

export async function deleteSentEmail(id: string): Promise<void> {
  const { error } = await supabase.from('sent_emails').delete().eq('id', id);
  if (error) console.error('[emailService] Error deleteSentEmail:', error.message);
}

export async function markSentStarred(id: string, starred: boolean): Promise<void> {
  const { error } = await supabase.from('sent_emails').update({ starred }).eq('id', id);
  if (error) console.error('[emailService] Error markSentStarred:', error.message);
}

export async function markSentImportant(id: string, important: boolean): Promise<void> {
  const { error } = await supabase.from('sent_emails').update({ important }).eq('id', id);
  if (error) console.error('[emailService] Error markSentImportant:', error.message);
}

// ================================================================
// PAPELERA — fetch, vaciar y auto-borrado 30 días
// ================================================================
export async function fetchTrashedEmails(): Promise<Email[]> {
  const [inbound, sent, contact] = await Promise.all([
    supabase.from('inbound_emails').select('*').not('trashed_at', 'is', null).order('trashed_at', { ascending: false }),
    supabase.from('sent_emails').select('*').not('trashed_at', 'is', null).order('trashed_at', { ascending: false }),
    supabase.from('contact_messages').select('*').not('trashed_at', 'is', null).order('trashed_at', { ascending: false }),
  ]);

  const inboundEmails = ((inbound.data ?? []) as InboundEmail[]).map(m => ({ ...inboundEmailToEmail(m), folder: 'trash' as const }));
  const sentEmails = ((sent.data ?? []) as SentEmailRow[]).map(row => {
    const date = new Date(row.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const dateLabel = diffDays === 0 ? 'Hoy' : diffDays === 1 ? 'Ayer' : date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const timeLabel = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const initials = (row.from_name || row.from_email).split(' ').slice(0, 2).map(n => n[0]?.toUpperCase() ?? '').join('');
    return {
      id: `sent_${row.id}`, _sentId: row.id,
      sender: row.from_name ? `${row.from_name} <${row.from_email}>` : row.from_email,
      senderEmail: row.from_email, recipient: row.to_email,
      avatar: initials, subject: row.subject ?? '(Sin asunto)',
      snippet: (row.text_body ?? '').substring(0, 100),
      body: row.html_body ?? '', date: dateLabel, time: timeLabel,
      folder: 'trash' as const, read: true, starred: row.starred, important: row.important,
      labels: row.labels ?? [], isSent: true,
    } as Email;
  });
  const contactEmails = ((contact.data ?? []) as ContactMessage[]).map(m => ({ ...contactMessageToEmail(m), folder: 'trash' as const }));

  return [...inboundEmails, ...sentEmails, ...contactEmails].sort((a, b) => b.date.localeCompare(a.date));
}

export async function emptyTrashFromSupabase(): Promise<void> {
  await Promise.all([
    supabase.from('inbound_emails').delete().not('trashed_at', 'is', null),
    supabase.from('sent_emails').delete().not('trashed_at', 'is', null),
    supabase.from('contact_messages').delete().not('trashed_at', 'is', null),
  ]);
}

export async function autoDeleteOldTrash(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await Promise.all([
    supabase.from('inbound_emails').delete().lt('trashed_at', cutoff),
    supabase.from('sent_emails').delete().lt('trashed_at', cutoff),
    supabase.from('contact_messages').delete().lt('trashed_at', cutoff),
  ]);
}

export async function restoreContactMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from('contact_messages')
    .update({ trashed_at: null })
    .eq('id', id);
  if (error) console.error('[emailService] Error restoreContactMessage:', error.message);
}

export async function restoreInboundEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('inbound_emails')
    .update({ trashed_at: null })
    .eq('id', id);
  if (error) console.error('[emailService] Error restoreInboundEmail:', error.message);
}

export async function restoreSentEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('sent_emails')
    .update({ trashed_at: null })
    .eq('id', id);
  if (error) console.error('[emailService] Error restoreSentEmail:', error.message);
}

// ================================================================
// CONFIGURACIÓN DE BUZONES (mailbox_settings)
// ================================================================
export interface MailboxSettings {
  email: string;
  inbox_enabled: boolean;
  auto_delete: boolean;
  auto_reply_enabled: boolean;
  auto_reply_subject: string;
  auto_reply_body: string;
}

export async function fetchMailboxSettings(): Promise<Record<string, MailboxSettings>> {
  const { data, error } = await supabase.from('mailbox_settings').select('*');
  if (error) { console.error('[emailService] fetchMailboxSettings:', error.message); return {}; }
  return Object.fromEntries((data ?? []).map((r: MailboxSettings) => [r.email, r]));
}

export async function saveMailboxSettings(settings: MailboxSettings): Promise<void> {
  const { error } = await supabase
    .from('mailbox_settings')
    .upsert(settings, { onConflict: 'email' });
  if (error) console.error('[emailService] saveMailboxSettings:', error.message);
}
