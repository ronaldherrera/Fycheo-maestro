export interface Mailbox {
  email: string;
  label: string;
  displayName: string;
  inbox: boolean;
  color: string;
}

export const MAILBOXES: Mailbox[] = [
  { email: 'hola@fycheo.es',           label: 'hola',           displayName: 'Fycheo',           inbox: true,  color: '#8b5cf6' },
  { email: 'soporte@fycheo.es',         label: 'soporte',        displayName: 'Fycheo Soporte',   inbox: true,  color: '#3b82f6' },
  { email: 'administracion@fycheo.es',  label: 'administración', displayName: 'Fycheo Admin',     inbox: true,  color: '#10b981' },
  { email: 'ronaldherrera@fycheo.es',   label: 'ronaldherrera',  displayName: 'Ronald Herrera',   inbox: true,  color: '#f59e0b' },
  { email: 'noreply@fycheo.es',         label: 'noreply',        displayName: 'Fycheo',           inbox: false, color: '#6b7280' },
  { email: 'info@fycheo.es',            label: 'info',           displayName: 'Fycheo Info',      inbox: false, color: '#ec4899' },
  { email: 'marketing@fycheo.es',       label: 'marketing',      displayName: 'Fycheo Marketing', inbox: true,  color: '#06b6d4' },
  { email: 'contacto@fycheo.es',        label: 'contacto',       displayName: 'Fycheo Contacto',  inbox: true,  color: '#f97316' },
];

export function loadSignatures(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('fycheo_signatures') ?? '{}'); } catch { return {}; }
}
export function saveSignatures(sigs: Record<string, string>) {
  localStorage.setItem('fycheo_signatures', JSON.stringify(sigs));
}
