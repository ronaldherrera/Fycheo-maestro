import { Email, Campaign, MailTemplate } from './types';

export const initialEmails: Email[] = [];

export const initialCampaigns: Campaign[] = [
  {
    id: 'c1',
    name: 'Boletín Mensual Novedades - Junio',
    subject: '📢 Nuevas funcionalidades de control horario y gestión de nóminas',
    target: 'Todos los clientes (Empresas y Mánagers)',
    sentDate: '05/06/2026',
    sentCount: 142,
    openRate: 78.4,
    clickRate: 32.1,
    status: 'sent',
    content: 'Descubre los nuevos cuadrantes automáticos y la exportación oficial a PDF en un clic...'
  },
  {
    id: 'c2',
    name: 'Alerta de Mantenimiento Supabase',
    subject: '⚠️ Parada técnica programada por actualización de base de datos',
    target: 'Administradores Técnicos',
    sentDate: '01/06/2026',
    sentCount: 28,
    openRate: 92.8,
    clickRate: 15.0,
    status: 'sent',
    content: 'El domingo realizaremos labores de optimización que provocarán microcortes...'
  },
  {
    id: 'c3',
    name: 'Campaña Recordatorio de Control Horario Legal',
    subject: '⚖️ ¿Tu empresa cumple con el RD-ley 8/2019? Evita multas de inspección',
    target: 'Empresas con Plan Free',
    sentDate: '28/05/2026',
    sentCount: 84,
    openRate: 64.2,
    clickRate: 41.5,
    status: 'sent',
    content: 'Te recordamos que almacenar registros en papel no es inalterable. Pásate a Pro...'
  }
];

export const initialTemplates: MailTemplate[] = [
  {
    id: 't1',
    name: 'Invitación a Empleado',
    subject: 'Has sido invitado a unirte a {company_name} en Fycheo',
    content: `<html>
  <body style="font-family: sans-serif; color: #333; line-height: 1.5; padding: 20px;">
    <h2 style="color: #8b5cf6;">¡Hola, {full_name}!</h2>
    <p>Has sido invitado por tu empresa <strong>{company_name}</strong> a unirte a Fycheo para registrar tu jornada de control horario de manera digital y rápida.</p>
    <p>Haz clic en el siguiente botón para activar tu cuenta, definir tu contraseña y empezar a registrar tu entrada/salida:</p>
    <p style="margin: 24px 0;">
      <a href="{activation_link}" style="background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">Activar Mi Cuenta</a>
    </p>
    <p>Si tienes alguna consulta, puedes responder a este correo o contactar con el responsable de personal de tu empresa.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
    <p style="font-size: 11px; color: #999;">Este es un mensaje de notificación de Fycheo. No compartas tu enlace de activación.</p>
  </body>
</html>`
  },
  {
    id: 't2',
    name: 'Recuperación de Contraseña',
    subject: 'Restablece tu contraseña de acceso a Fycheo',
    content: `<html>
  <body style="font-family: sans-serif; color: #333; line-height: 1.5; padding: 20px;">
    <h2 style="color: #3b82f6;">Solicitud de restablecimiento</h2>
    <p>Hola, <strong>{full_name}</strong>.</p>
    <p>Hemos recibido una petición para restablecer la contraseña asociada a tu cuenta de Fycheo en <strong>{company_name}</strong>.</p>
    <p>Para crear una nueva contraseña, haz clic en el siguiente enlace:</p>
    <p style="margin: 24px 0;">
      <a href="{activation_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
    </p>
    <p>Si tú no has solicitado este cambio, por favor ignora este correo. Tu contraseña actual seguirá siendo segura.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
    <p style="font-size: 11px; color: #999;">Enlace de recuperación válido durante 24 horas.</p>
  </body>
</html>`
  },
  {
    id: 't3',
    name: 'Alerta de Inspección del Trabajo',
    subject: '⚠️ Importante: Verifica tu registro de control horario del trimestre',
    content: `<html>
  <body style="font-family: sans-serif; color: #333; line-height: 1.5; padding: 20px; border-left: 4px solid #f59e0b;">
    <h2 style="color: #d97706;">Alerta Preventiva de Inspección</h2>
    <p>Estimado mánager de <strong>{company_name}</strong>,</p>
    <p>Te recordamos que, conforme a la legislación española de control de jornada, es obligatorio conservar el registro inalterable de firmas de tus empleados durante un plazo de <strong>4 años</strong>.</p>
    <p>Hemos detectado incidencias o registros incompletos esta semana. Te sugerimos revisar las firmas en el portal de Fycheo:</p>
    <p style="margin: 20px 0;">
      <a href="{activation_link}" style="background-color: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Revisar Incidencias de Fichajes</a>
    </p>
    <p>Mantener tus informes validados previene multas que pueden ascender hasta los 7.500€.</p>
  </body>
</html>`
  }
];
