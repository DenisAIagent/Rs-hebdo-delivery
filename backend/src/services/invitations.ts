import { supabaseAdmin } from '../utils/supabase';
import { getEmailConfig } from './email';
import { buildInviteEmail } from './inviteEmail';

export interface InvitationResult {
  sent: boolean;
  /** Raison lisible par l'admin quand l'envoi n'a pas eu lieu. */
  reason?: string;
}

/**
 * Envoie a un compte un lien a usage unique pour definir son mot de passe.
 * Le lien (type recovery) ouvre la page /reset-password de l'app, deja utilisee
 * pour « mot de passe oublie ». Ne leve jamais : le resultat dit si c'est parti.
 */
export async function sendInvitation(params: {
  email: string;
  fullName: string;
  reminder?: boolean;
}): Promise<InvitationResult> {
  const appUrl = process.env.FRONTEND_URL?.trim().replace(/\/+$/, '');
  if (!appUrl) return { sent: false, reason: 'Adresse de l\'app (FRONTEND_URL) non configurée sur le serveur' };

  const cfg = await getEmailConfig();
  if (!cfg.apiKey) return { sent: false, reason: 'Envoi d\'email non configuré (Admin > Réglages > Email)' };

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email: params.email,
    options: { redirectTo: `${appUrl}/reset-password` },
  });
  const link = data?.properties?.action_link;
  if (error || !link) {
    console.error('[invitation] generateLink failed:', error?.message);
    return { sent: false, reason: 'Impossible de générer le lien d\'invitation' };
  }

  const { subject, html, text } = buildInviteEmail({
    fullName: params.fullName,
    link,
    appUrl,
    reminder: params.reminder,
  });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [params.email], subject, html, text }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      console.error('[invitation] Resend API error:', body);
      return { sent: false, reason: `Envoi refusé par Resend : ${body?.message || response.status}` };
    }
    console.log(`[invitation] ${params.reminder ? 'Relance' : 'Invitation'} envoyée à ${params.email}`);
    return { sent: true };
  } catch (err) {
    console.error('[invitation] Failed to send email:', err);
    return { sent: false, reason: 'Envoi de l\'email impossible (réseau)' };
  }
}
