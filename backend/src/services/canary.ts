import { supabaseAdmin } from '../utils/supabase';
import { getEmailConfig, type EmailConfig } from './email';
import {
  nextCanaryState,
  buildCanaryAlertEmail,
  type CanaryComponent,
  type CanaryState,
  type CanaryTransition,
} from './canaryState';

/**
 * Canari, cote serveur Railway : controle la base Supabase toutes les heures
 * et previent le ou les CTO par email (Resend) au debut d'une panne et au retour
 * a la normale. Le sens inverse (Supabase surveille le serveur Railway) est une
 * tache pg_cron en base : voir supabase/migrations/20261006000000_cto_canary.sql.
 *
 * Quand la base est en panne, on ne peut plus y lire ni les CTO ni la cle Resend :
 * on garde donc en memoire les derniers connus, avec repli sur CTO_ALERT_EMAIL.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // toutes les heures
const FIRST_CHECK_DELAY_MS = 60 * 1000;
const DB_TIMEOUT_MS = 10_000;

let supabaseState: CanaryState | null = null;
let lastCtoEmails: string[] = [];
let lastEmailConfig: EmailConfig | null = null;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`pas de reponse en ${ms / 1000} s`)), ms)),
  ]);
}

async function checkSupabase(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const { data, error } = await withTimeout(
      supabaseAdmin.from('hebdo_config').select('label').eq('is_current', true).maybeSingle(),
      DB_TIMEOUT_MS,
    );
    if (error) return { ok: false, detail: error.message };
    if (!data) return { ok: false, detail: 'Aucun numéro en cours dans hebdo_config' };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Rafraichit les destinataires et la config email tant que la base repond. */
async function refreshAlertTargets(): Promise<void> {
  const { data } = await supabaseAdmin.from('profiles').select('email').eq('role', 'cto').eq('is_active', true);
  lastCtoEmails = (data || []).map((p: { email: string }) => p.email).filter(Boolean);
  lastEmailConfig = await getEmailConfig();
}

function alertRecipients(): string[] {
  if (lastCtoEmails.length > 0) return lastCtoEmails;
  return (process.env.CTO_ALERT_EMAIL || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function sendCanaryAlert(params: {
  component: CanaryComponent;
  transition: CanaryTransition;
  since: string;
  detail?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const cfg = lastEmailConfig ?? (await getEmailConfig().catch(() => null));
  const to = alertRecipients();
  if (!cfg?.apiKey) return { sent: false, reason: 'Envoi d\'email non configuré (Admin > Réglages > Email)' };
  if (to.length === 0) return { sent: false, reason: 'Aucun CTO actif enregistré (rôle CTO dans Journalistes)' };

  const { subject, html, text } = buildCanaryAlertEmail({
    ...params,
    appUrl: process.env.FRONTEND_URL || '',
  });
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to, subject, html, text }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      console.error('[canary] Resend API error:', body);
      return { sent: false, reason: `Envoi refusé par Resend : ${body.message || response.status}` };
    }
    console.log(`[canary] Alerte ${params.transition} (${params.component}) envoyée à ${to.length} CTO`);
    return { sent: true };
  } catch (err) {
    console.error('[canary] Failed to send alert:', err);
    return { sent: false, reason: 'Envoi de l\'email impossible (réseau)' };
  }
}

async function persistState(component: CanaryComponent, state: CanaryState): Promise<void> {
  const { error } = await supabaseAdmin.from('canary_state').upsert(
    {
      component,
      status: state.status,
      since: state.since,
      detail: state.detail ?? null,
      last_checked: new Date().toISOString(),
    },
    { onConflict: 'component' },
  );
  if (error) console.error('[canary] Enregistrement de l\'etat impossible:', error.message);
}

export async function runCanary(): Promise<CanaryState> {
  const check = await checkSupabase();
  const { state, transition } = nextCanaryState(supabaseState, check, new Date());
  supabaseState = state;

  if (check.ok) {
    try {
      await refreshAlertTargets();
    } catch (err) {
      console.error('[canary] Lecture des CTO impossible:', err);
    }
    await persistState('supabase', state);
  } else {
    console.error(`[canary] Supabase en echec : ${state.detail}`);
  }

  if (transition) {
    await sendCanaryAlert({ component: 'supabase', transition, since: state.since, detail: state.detail });
  }
  return state;
}

/** Derniers etats connus : Supabase (vu par le serveur) et Railway (vu par la base). */
export async function getCanaryStatus(): Promise<{
  supabase: CanaryState | null;
  railway: (CanaryState & { last_checked?: string }) | null;
  ctoCount: number;
}> {
  const { data } = await supabaseAdmin.from('canary_state').select('*').eq('component', 'railway').maybeSingle();
  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'cto')
    .eq('is_active', true);
  return {
    supabase: supabaseState,
    railway: data ? { status: data.status, since: data.since, detail: data.detail, last_checked: data.last_checked } : null,
    ctoCount: count ?? 0,
  };
}

export function startCanary(): void {
  console.log('[canary] Surveillance de Supabase activée (toutes les heures)');
  setTimeout(() => {
    void runCanary();
    setInterval(() => void runCanary(), CHECK_INTERVAL_MS);
  }, FIRST_CHECK_DELAY_MS);
}
