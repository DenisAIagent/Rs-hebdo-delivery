import { supabaseAdmin } from '../utils/supabase';
import type { FieldRule } from './fieldValidation';

/**
 * Interrupteur admin « chapo, clip YouTube et lien d'achat obligatoires »
 * (app_settings.STRICT_EDITORIAL_FIELDS, Admin > Reglages).
 * Coupe, ces trois champs deviennent facultatifs partout : formulaire (via
 * GET /paper-types) et validation serveur. La config des types n'est pas
 * modifiee : rallumer l'interrupteur retablit les regles du 01/10/2026.
 */
export const STRICT_SETTING_KEY = 'STRICT_EDITORIAL_FIELDS';
export const EDITORIAL_KEYS: ReadonlySet<string> = new Set(['chapo', 'lien', 'lien_achat']);

/** Absent ou illisible = obligatoire (comportement historique). */
export function parseStrictSetting(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false';
}

export function applyFieldPolicy(fields: FieldRule[], strict: boolean): FieldRule[] {
  if (strict) return fields;
  return fields.map((f) => (EDITORIAL_KEYS.has(f.key) && f.required ? { ...f, required: false } : f));
}

export async function isStrictEditorialFields(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', STRICT_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error('[fieldPolicy] lecture du reglage impossible, regles strictes appliquees:', error.message);
    return true;
  }
  return parseStrictSetting(data?.value);
}
