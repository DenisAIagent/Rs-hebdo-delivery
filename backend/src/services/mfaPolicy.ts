import { supabaseAdmin } from '../utils/supabase';

/**
 * Politique 2FA (TOTP), pilotee depuis l'admin (app_settings.REQUIRE_MFA).
 * - REQUIRE_MFA=true en variable d'environnement force l'activation (verrou serveur).
 * - Sinon la valeur en base fait foi ; absente = desactivee.
 * Mise en cache 30 s pour ne pas interroger la base a chaque requete API.
 */
const CACHE_TTL_MS = 30_000;
const SETTING_KEY = 'REQUIRE_MFA';

let cached: { value: boolean; at: number } | null = null;

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
    console.error('[mfa-policy] Lecture REQUIRE_MFA impossible, 2FA consideree desactivee:', err);
    cached = { value: false, at: now };
  }
  return cached.value;
}

/** A appeler apres modification du reglage en admin. */
export function invalidateMfaPolicyCache(): void {
  cached = null;
}
