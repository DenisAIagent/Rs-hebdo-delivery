/**
 * Logique pure du canari : transitions d'etat (une alerte au debut d'une panne,
 * une au retour a la normale, rien entre les deux) et contenu des emails.
 */

export type CanaryComponent = 'supabase' | 'railway';
export type CanaryStatus = 'ok' | 'down';
export type CanaryTransition = 'down' | 'up' | 'test';

export interface CanaryState {
  status: CanaryStatus;
  /** Debut de l'etat courant (ISO). */
  since: string;
  detail?: string | null;
}

export const COMPONENT_LABELS: Record<CanaryComponent, string> = {
  supabase: 'Base Supabase',
  railway: 'Serveur Railway',
};

export function nextCanaryState(
  prev: CanaryState | null,
  check: { ok: boolean; detail?: string },
  now: Date,
): { state: CanaryState; transition: 'down' | 'up' | null } {
  const status: CanaryStatus = check.ok ? 'ok' : 'down';
  const detail = check.ok ? null : check.detail || 'Echec du controle';
  if (prev && prev.status === status) {
    return { state: { ...prev, detail }, transition: null };
  }
  const state = { status, since: now.toISOString(), detail };
  // Premier controle : on ne previent que s'il est deja en echec.
  if (!prev) return { state, transition: check.ok ? null : 'down' };
  return { state, transition: check.ok ? 'up' : 'down' };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TONES: Record<CanaryTransition, { color: string; word: string; lead: string }> = {
  down: {
    color: '#B30E1F',
    word: 'en panne',
    lead: 'Le canari a détecté un échec lors du contrôle horaire.',
  },
  up: {
    color: '#1F7A3A',
    word: 'rétabli',
    lead: 'Le contrôle horaire repasse au vert.',
  },
  test: {
    color: '#16140F',
    word: 'alerte de test',
    lead: 'Ceci est une alerte de test envoyée depuis l\'administration : les alertes du canari arrivent bien.',
  },
};

export function buildCanaryAlertEmail(p: {
  component: CanaryComponent;
  transition: CanaryTransition;
  since: string;
  detail?: string | null;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const label = COMPONENT_LABELS[p.component];
  const tone = TONES[p.transition];
  const prefix = p.transition === 'down' ? '🔴' : p.transition === 'up' ? '🟢' : '🧪';
  const subject =
    p.transition === 'test'
      ? `${prefix} [RS Hebdo] Canari — ${tone.word}`
      : `${prefix} [RS Hebdo] ${label} ${tone.word}`;
  const sinceFr = new Date(p.since).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const appUrl = p.appUrl.replace(/\/+$/, '');

  const rows = [
    ['Composant', label],
    [p.transition === 'up' ? 'Rétabli le' : 'Depuis le', sinceFr],
    ...(p.detail ? [['Détail', p.detail]] : []),
  ]
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 0; width:120px; color:#6A6557;">${escapeHtml(k)}</td><td style="padding:6px 0; color:#16140F;">${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#F5F0E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F5F0E6;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background:#FBF8F2; border:1px solid #E8E2D2; border-radius:6px;">
<tr><td style="height:6px; background:${tone.color}; border-radius:6px 6px 0 0; font-size:0; line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px; font-family:Helvetica,Arial,sans-serif; font-size:12px; letter-spacing:2px; text-transform:uppercase; color:#6A6557;">RS Hebdo Delivery · Canari</td></tr>
<tr><td style="padding:0 32px 12px; font-family:Georgia,'Times New Roman',serif; font-size:26px; line-height:1.2; color:${tone.color};">${escapeHtml(label)} ${escapeHtml(tone.word)}</td></tr>
<tr><td style="padding:0 32px 16px; font-family:Helvetica,Arial,sans-serif; font-size:15px; line-height:1.55; color:#16140F;">${escapeHtml(tone.lead)}</td></tr>
<tr><td style="padding:0 32px 24px; font-family:Helvetica,Arial,sans-serif; font-size:14px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table></td></tr>
<tr><td style="padding:16px 32px; background:#F5F0E6; border-top:1px solid #E8E2D2; border-radius:0 0 6px 6px; font-family:Helvetica,Arial,sans-serif; font-size:12px; color:#6A6557;">Vous recevez cette alerte en tant que CTO de RS Hebdo Delivery · <a href="${escapeHtml(appUrl)}" style="color:#16140F;">${escapeHtml(appUrl.replace(/^https?:\/\//, ''))}</a></td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    `${label} ${tone.word}`,
    tone.lead,
    `${p.transition === 'up' ? 'Rétabli le' : 'Depuis le'} : ${sinceFr}`,
    ...(p.detail ? [`Détail : ${p.detail}`] : []),
    '',
    appUrl,
  ].join('\n');

  return { subject, html, text };
}
