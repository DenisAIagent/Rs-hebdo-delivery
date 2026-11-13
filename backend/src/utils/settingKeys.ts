/**
 * Cles autorisees dans la table app_settings. Toute ecriture (admin ou wizard
 * de setup) passe par ces listes : une cle inconnue est refusee.
 */
export const SETTING_KEYS: ReadonlySet<string> = new Set([
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_WORKSPACE_ID',
  'CANARY_APP_URL',
  'CLAUDE_MODEL',
  'DELIVERY_NOTIFICATIONS',
  'DROPBOX_APP_KEY',
  'DROPBOX_APP_SECRET',
  'DROPBOX_REFRESH_TOKEN',
  'DROPBOX_ROOT_FOLDER',
  'GEMINI_API_KEY',
  'MISTRAL_API_KEY',
  'NOTIFY_EMAIL_ALMA',
  'NOTIFY_EMAIL_DENIS',
  'RECAP_LAST_SENT',
  'REQUIRE_MFA',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'STRICT_EDITORIAL_FIELDS',
  'WORDPRESS_APP_PASSWORD',
  'WORDPRESS_ENABLED',
  'WORDPRESS_URL',
  'WORDPRESS_USERNAME',
  'WP_META_MAP',
]);

/**
 * Cles que le wizard d'installation peut ecrire. Volontairement sans
 * REQUIRE_MFA (il ne doit pas pouvoir couper la double authentification) ni
 * WORDPRESS_* / CANARY_APP_URL (pas de redirection des publications).
 */
export const SETUP_KEYS: ReadonlySet<string> = new Set([
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_WORKSPACE_ID',
  'CLAUDE_MODEL',
  'DROPBOX_APP_KEY',
  'DROPBOX_APP_SECRET',
  'DROPBOX_REFRESH_TOKEN',
  'DROPBOX_ROOT_FOLDER',
  'GEMINI_API_KEY',
  'MISTRAL_API_KEY',
  'NOTIFY_EMAIL_ALMA',
  'NOTIFY_EMAIL_DENIS',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
]);

/** Taille maximale d'une valeur de reglage. */
export const MAX_SETTING_LENGTH = 10_000;

export function isAllowedSettingKey(key: unknown, allowed: ReadonlySet<string> = SETTING_KEYS): key is string {
  return typeof key === 'string' && allowed.has(key);
}
