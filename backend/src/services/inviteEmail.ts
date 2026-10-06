/**
 * Email d'invitation : un nouveau membre de l'equipe definit lui-meme son mot
 * de passe via un lien a usage unique. Charte de l'app (papier creme, encre,
 * rouge Rolling Stone, serif), mise en page en tableaux pour les clients mail.
 */

const COLORS = {
  red: '#E11D2E',
  redDeep: '#B30E1F',
  ink: '#16140F',
  muted: '#6A6557',
  paper: '#FBF8F2',
  paper2: '#F5F0E6',
  rule: '#E8E2D2',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHttpUrl(url: string): string | null {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export interface InviteEmailParams {
  fullName: string;
  /** Lien Supabase a usage unique qui ouvre la page « Nouveau mot de passe ». */
  link: string;
  /** Adresse publique de l'app (FRONTEND_URL), pour le logo et le lien de connexion. */
  appUrl: string;
  /** true = renvoi demande par l'admin (lien precedent expire ou perdu). */
  reminder?: boolean;
}

export function buildInviteEmail(p: InviteEmailParams): { subject: string; html: string; text: string } {
  const appUrl = (safeHttpUrl(p.appUrl) || '').replace(/\/+$/, '');
  const link = safeHttpUrl(p.link) || appUrl || '#';
  const firstName = p.fullName.trim().split(/\s+/)[0] || p.fullName.trim();
  const safeName = escapeHtml(firstName);
  const safeLink = escapeHtml(link);
  const logoUrl = escapeHtml(`${appUrl}/logo-rs-france.png`);

  const subject = p.reminder
    ? 'Votre nouveau lien pour accéder à RS Hebdo Delivery'
    : 'Bienvenue sur RS Hebdo Delivery — définissez votre mot de passe';
  const lead = p.reminder
    ? 'Voici un nouveau lien pour définir votre mot de passe et accéder à votre espace.'
    : 'Votre compte RS Hebdo Delivery est prêt. C\'est ici que vous livrerez vos papiers pour l\'hebdo de Rolling Stone France.';

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
<style>
  @media (max-width: 480px) {
    .px { padding-left: 22px !important; padding-right: 22px !important; }
    .h1 { font-size: 26px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background:${COLORS.paper2};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(lead)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.paper2};">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:${COLORS.paper}; border:1px solid ${COLORS.rule}; border-radius:6px;">
        <tr><td style="height:6px; background:${COLORS.red}; border-radius:6px 6px 0 0; font-size:0; line-height:0;">&nbsp;</td></tr>
        <tr>
          <td class="px" align="center" style="padding:36px 40px 8px;">
            <img src="${logoUrl}" width="240" alt="Rolling Stone France" style="display:block; width:240px; max-width:100%; height:auto; border:0;">
          </td>
        </tr>
        <tr>
          <td class="px" align="center" style="padding:4px 40px 28px; font-family:Georgia,'Times New Roman',serif; font-size:13px; letter-spacing:3px; text-transform:uppercase; color:${COLORS.muted};">
            RS Hebdo Delivery
          </td>
        </tr>
        <tr><td class="px" style="padding:0 40px;"><div style="border-top:1px solid ${COLORS.rule}; font-size:0; line-height:0;">&nbsp;</div></td></tr>
        <tr>
          <td class="px" style="padding:32px 40px 8px; font-family:Georgia,'Times New Roman',serif; color:${COLORS.ink};">
            <h1 class="h1" style="margin:0 0 16px; font-size:30px; line-height:1.15; font-weight:normal; font-style:italic;">Bonjour ${safeName},</h1>
            <p style="margin:0 0 16px; font-size:17px; line-height:1.55;">${escapeHtml(lead)}</p>
            <p style="margin:0; font-size:17px; line-height:1.55;">Pour commencer, choisissez votre mot de passe&nbsp;:</p>
          </td>
        </tr>
        <tr>
          <td class="px" align="center" style="padding:28px 40px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${COLORS.red}" style="border-radius:4px; border-bottom:3px solid ${COLORS.redDeep};">
                  <a href="${safeLink}" style="display:inline-block; padding:15px 34px; font-family:Helvetica,Arial,sans-serif; font-size:16px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:4px;">Définir mon mot de passe</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:0 40px 32px; font-family:Helvetica,Arial,sans-serif; font-size:13px; line-height:1.6; color:${COLORS.muted};">
            Ce lien est personnel et ne fonctionne qu'une fois. S'il a expiré, demandez un nouvel envoi à la rédaction.<br><br>
            Le bouton ne fonctionne pas&nbsp;? Copiez ce lien dans votre navigateur&nbsp;:<br>
            <a href="${safeLink}" style="color:${COLORS.redDeep}; word-break:break-all;">${safeLink}</a>
          </td>
        </tr>
        <tr>
          <td class="px" style="padding:20px 40px; background:${COLORS.paper2}; border-top:1px solid ${COLORS.rule}; border-radius:0 0 6px 6px; font-family:Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:${COLORS.muted};">
            Ensuite, connectez-vous à tout moment sur <a href="${escapeHtml(appUrl || '#')}" style="color:${COLORS.ink}; word-break:break-all;">${escapeHtml(appUrl.replace(/^https?:\/\//, ''))}</a> avec votre adresse email et ce mot de passe.<br>
            Vous recevez ce message parce que la rédaction de Rolling Stone France vous a ouvert un accès.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `Bonjour ${firstName},`,
    '',
    lead,
    '',
    'Pour commencer, choisissez votre mot de passe :',
    safeHttpUrl(p.link) || appUrl,
    '',
    "Ce lien est personnel et ne fonctionne qu'une fois. S'il a expiré, demandez un nouvel envoi à la rédaction.",
    '',
    `Ensuite, connectez-vous sur ${appUrl} avec votre adresse email et ce mot de passe.`,
    '',
    'Rolling Stone France — RS Hebdo Delivery',
  ].join('\n');

  return { subject, html, text };
}
