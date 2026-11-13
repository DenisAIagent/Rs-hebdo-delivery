import { supabaseAdmin } from '../utils/supabase';
import { describeError } from '../utils/safeError';

/**
 * Politique 2FA (TOTP), pilotee depuis l'admin (app_settings.REQUIRE_MFA).
 * - REQUIRE_MFA=true en variable d'environnement force l'activation (verrou serveur).
 * - Sinon la valeur en base fait foi ; absente = desactivee.
 * - Base illisible : derniere valeur connue, sinon 2FA exigee (fail-closed).
 * Mise en cache 30 s pour ne pas interroger la base a chaque requete API.
 */
const CACHE_TTL_MS = 30_000;
const SETTING_KEY = 'REQUIRE_MFA';

let cached: { value: boolean; at: number } | null = null;
// Derniere valeur lue avec succes en base (sert de repli en cas d'incident).
let lastKnown: boolean | null = null;

function parseFlag(v: string | null | undefined): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'true' || s === '1';
}

export async function isMfaRequired(): Promise<boolean> {
  if (process.env.REQUIRE_MFA === 'true') return true;

  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', SETTING_KEY)
      .maybeSingle();
    if (error) throw error;
    cached = { value: parseFlag(data?.value), at: now };
  } catch (err) {
    // Fail-closed : un incident de base ne doit jamais couper la 2FA. On garde
    // la derniere valeur connue ; si on n'en a aucune, la 2FA est exigee.
    const fallback = lastKnown ?? true;
    console.error(`[mfa-policy] Lecture REQUIRE_MFA impossible, 2FA consideree ${fallback ? 'requise' : 'desactivee (derniere valeur connue)'}:`, describeError(err));
    cached = { value: fallback, at: now };
    return fallback;
  }
  lastKnown = cached.value;
  return cached.value;
}

/** A appeler apres modification du reglage en admin. */
export function invalidateMfaPolicyCache(): void {
  cached = null;
}
