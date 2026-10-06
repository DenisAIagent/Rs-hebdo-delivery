import { createHash } from 'node:crypto';
import { supabaseAdmin } from '../utils/supabase';

/**
 * Configuration Dropbox : app_settings (admin > Reglages > Dropbox) en priorite,
 * variables d'environnement en secours — meme regle que l'email (Resend).
 * Mise en cache 30 s pour ne pas interroger la base a chaque appel Dropbox.
 */
export const DEFAULT_ROOT_FOLDER = '/Hebdo Delivery';

const CACHE_TTL_MS = 30_000;
const KEYS = ['DROPBOX_APP_KEY', 'DROPBOX_APP_SECRET', 'DROPBOX_REFRESH_TOKEN', 'DROPBOX_ROOT_FOLDER'] as const;

type SettingsMap = Partial<Record<string, string | null | undefined>>;

export interface DropboxConfig {
  appKey: string;
  appSecret: string;
  refreshToken: string;
  rootFolder: string;
}

export function resolveDropboxConfig(fromDb: SettingsMap, env: SettingsMap): DropboxConfig {
  const pick = (k: string) => fromDb[k]?.trim() || env[k]?.trim() || '';
  return {
    appKey: pick('DROPBOX_APP_KEY'),
    appSecret: pick('DROPBOX_APP_SECRET'),
    refreshToken: pick('DROPBOX_REFRESH_TOKEN'),
    rootFolder: pick('DROPBOX_ROOT_FOLDER') || DEFAULT_ROOT_FOLDER,
  };
}

/** Empreinte des identifiants, pour savoir si le token en cache est encore valable. */
export function credentialsFingerprint(cfg: DropboxConfig): string {
  return createHash('sha256')
    .update(`${cfg.appKey}\n${cfg.appSecret}\n${cfg.refreshToken}`)
    .digest('hex');
}

let cached: { value: DropboxConfig; at: number } | null = null;
// Derniere config lue, conservee pendant un rechargement (cache invalide).
let lastKnown: DropboxConfig | null = null;

export async function loadDropboxConfig(): Promise<DropboxConfig> {
  const now = Date.now();
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  const fromDb: Record<string, string> = {};
  try {
    const { data, error } = await supabaseAdmin.from('app_settings').select('key, value').in('key', [...KEYS]);
    if (error) throw error;
    for (const row of data || []) if (row.value) fromDb[row.key] = row.value;
  } catch (err) {
    console.error('[Dropbox] Lecture des reglages impossible, variables d\'environnement utilisees:', err);
  }
  cached = { value: resolveDropboxConfig(fromDb, process.env), at: now };
  lastKnown = cached.value;
  return cached.value;
}

/**
 * Dernier dossier racine connu, pour les fonctions synchrones (calcul des chemins).
 * Rafraichi a chaque loadDropboxConfig().
 */
export function getCachedRootFolder(): string {
  return (lastKnown ?? resolveDropboxConfig({}, process.env)).rootFolder;
}

/** A appeler apres modification d'un reglage DROPBOX_* en admin. */
export function invalidateDropboxConfigCache(): void {
  cached = null;
  void loadDropboxConfig();
}
