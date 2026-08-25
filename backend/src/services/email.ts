/**
 * Service de notification email via Resend.
 * https://resend.com
 */

import { supabaseAdmin } from '../utils/supabase';

/** Escape HTML special characters to prevent injection in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Validate URL protocol (only http/https allowed) */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
    return '#';
  } catch {
    return '#';
  }
}

export interface NotifyParams {
  journalistName: string;
  paperType: string;
  title: string;
  hebdoNumber: string;
  driveFolderUrl: string;
  signCount: number;
}

export async function notifyDelivery(params: NotifyParams) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'RS Hebdo <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured — email notification skipped');
    return;
  }

  const recipients = [
    process.env.NOTIFY_EMAIL_ALMA,
    process.env.NOTIFY_EMAIL_DENIS,
  ].filter(Boolean) as string[];

  if (recipients.length === 0) {
    console.warn('No notification recipients configured');
    return;
  }

  const safeJournalist = escapeHtml(params.journalistName);
  const safePaperType = escapeHtml(params.paperType);
  const safeTitle = escapeHtml(params.title);
  const safeHebdo = escapeHtml(params.hebdoNumber);
  const safeFolderUrl = sanitizeUrl(params.driveFolderUrl);

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #E50914; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Rolling Stone Hebdo</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Nouveau papier livr&eacute;</p>
      </div>

      <div style="padding: 24px; background: #f9f9f9;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Journaliste</td>
            <td style="padding: 8px 0; color: #555;">${safeJournalist}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Type de papier</td>
            <td style="padding: 8px 0; color: #555;">${safePaperType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Titre</td>
            <td style="padding: 8px 0; color: #555;">${safeTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Hebdo</td>
            <td style="padding: 8px 0; color: #555;">${safeHebdo}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Signes</td>
            <td style="padding: 8px 0; color: #555;">${params.signCount.toLocaleString('fr-FR')}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${safeFolderUrl}"
             style="display: inline-block; background: #E50914; color: white; padding: 12px 32px;
                    text-decoration: none; border-radius: 4px; font-weight: bold;">
            Ouvrir dans Dropbox
          </a>
        </div>
      </div>

      <div style="padding: 12px; text-align: center; color: #999; font-size: 12px;">
        RS Hebdo Delivery Platform
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: `[${safeHebdo}] ${safePaperType} — ${safeTitle} (${safeJournalist})`,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Resend API error:', error);
      return;
    }

    console.log(`Notification sent for: ${params.title}`);
  } catch (error) {
    console.error('Failed to send notification email:', error);
    // Don't throw - delivery shouldn't fail because of email
  }
}

/** Emails of all active admins (fallback: NOTIFY_EMAIL_* env vars). */
async function getAdminEmails(): Promise<string[]> {
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true);
    const emails = (data || []).map((p: { email: string }) => p.email).filter(Boolean);
    if (emails.length > 0) return emails;
  } catch {
    // fall through to env fallback
  }
  return [process.env.NOTIFY_EMAIL_ALMA, process.env.NOTIFY_EMAIL_DENIS].filter(Boolean) as string[];
}

export interface WpErrorNotifyParams {
  journalistName: string;
  paperType: string;
  title: string;
  hebdoNumber: string;
  errorDetail: string;
}

/**
 * Alerte les admins qu'un envoi WordPress a echoue, pour qu'ils corrigent
 * (identifiants, contenu...) puis relancent depuis l'onglet Livraisons.
 * Never throws — l'alerte ne doit pas casser le flux de livraison.
 */
export async function notifyWordpressError(params: WpErrorNotifyParams) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'RS Hebdo <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured — WordPress error email skipped');
    return;
  }

  const recipients = await getAdminEmails();
  if (recipients.length === 0) {
    console.warn('No admin recipients for WordPress error email');
    return;
  }

  const safeJournalist = escapeHtml(params.journalistName);
  const safePaperType = escapeHtml(params.paperType);
  const safeTitle = escapeHtml(params.title);
  const safeHebdo = escapeHtml(params.hebdoNumber);
  const safeError = escapeHtml(params.errorDetail).slice(0, 600);
  const appUrl = sanitizeUrl(process.env.FRONTEND_URL || '#');

  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #b91c1c; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 24px;">Rolling Stone Hebdo</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">&Eacute;chec de l'envoi WordPress</p>
      </div>

      <div style="padding: 24px; background: #f9f9f9;">
        <p style="color: #333; margin-top: 0;">
          La livraison ci-dessous a bien &eacute;t&eacute; effectu&eacute;e (Dropbox OK), mais
          <strong>l'envoi vers WordPress a &eacute;chou&eacute;</strong>. L'article n'a pas de brouillon sur le site.
        </p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333; width: 140px;">Journaliste</td>
            <td style="padding: 8px 0; color: #555;">${safeJournalist}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Type de papier</td>
            <td style="padding: 8px 0; color: #555;">${safePaperType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Titre</td>
            <td style="padding: 8px 0; color: #555;">${safeTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Hebdo</td>
            <td style="padding: 8px 0; color: #555;">${safeHebdo}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">Erreur</td>
            <td style="padding: 8px 0; color: #b91c1c; font-family: monospace; font-size: 13px;">${safeError}</td>
          </tr>
        </table>

        <p style="color: #333;">
          Pour corriger : v&eacute;rifiez les identifiants WordPress (Admin &rarr; Param&egrave;tres) et le d&eacute;tail
          dans l'onglet Logs (&eacute;tapes wp-*), puis relancez l'envoi depuis l'onglet Livraisons (ic&ocirc;ne globe).
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${appUrl}"
             style="display: inline-block; background: #b91c1c; color: white; padding: 12px 32px;
                    text-decoration: none; border-radius: 4px; font-weight: bold;">
            Ouvrir l'administration
          </a>
        </div>
      </div>

      <div style="padding: 12px; text-align: center; color: #999; font-size: 12px;">
        RS Hebdo Delivery Platform
      </div>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipients,
        subject: `⚠️ [${safeHebdo}] Échec WordPress — ${safeTitle} (${safeJournalist})`,
        html,
      }),
    });

    if (!response.ok) {
      console.error('Resend API error (WP alert):', await response.json());
      return;
    }
    console.log(`WordPress error alert sent to ${recipients.length} admin(s) for: ${params.title}`);
  } catch (error) {
    console.error('Failed to send WordPress error email:', error);
  }
}
