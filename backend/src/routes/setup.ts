import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { isAllowedSettingKey, SETUP_KEYS, MAX_SETTING_LENGTH } from '../utils/settingKeys';
import { supabaseAdmin } from '../utils/supabase';
import { describeError } from '../utils/safeError';

const router = Router();

/** Comparaison a temps constant (les deux valeurs sont hachees : longueurs egales). */
function tokensMatch(provided: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Le wizard est public : on plafonne les essais de jeton par adresse IP.
const configureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de configuration. Reessayez plus tard.' },
});

const REQUIRED_KEYS = [
  'ANTHROPIC_API_KEY',
  'DROPBOX_APP_KEY',
  'DROPBOX_APP_SECRET',
  'DROPBOX_REFRESH_TOKEN',
];

async function isAppConfigured(): Promise<boolean> {
  try {
    // First check: if env vars are set, the app is already configured
    const envConfigured = REQUIRED_KEYS.every((key) => {
      const val = process.env[key];
      return val && val.trim() !== '';
    });
    if (envConfigured) return true;

    // Second check: look in app_settings table
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', REQUIRED_KEYS);

    if (error || !data) return false;

    for (const key of REQUIRED_KEYS) {
      const setting = data.find((s: any) => s.key === key);
      if (!setting || !setting.value || setting.value.trim() === '') {
        return false;
      }
    }
    return true;
  } catch {
    // If anything fails (table doesn't exist, etc.), check env vars as fallback
    return REQUIRED_KEYS.every((key) => {
      const val = process.env[key];
      return val && val.trim() !== '';
    });
  }
}

// GET /api/setup/status - Check if the app is configured (PUBLIC, no auth)
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const configured = await isAppConfigured();
    return res.json({ configured });
  } catch {
    return res.status(500).json({ error: 'Erreur verification configuration' });
  }
});

// POST /api/setup/configure - Initial setup (requires SETUP_SECRET_TOKEN + app not yet configured)
router.post('/configure', configureLimiter, async (req: Request, res: Response) => {
  try {
    // Ferme par defaut : il faut l'ouvrir explicitement le temps de l'installation.
    if (process.env.SETUP_ENABLED !== 'true') {
      return res.status(404).json({ error: 'Not found' });
    }

    // Require setup token to prevent unauthorized configuration
    const SETUP_TOKEN = process.env.SETUP_SECRET_TOKEN;
    const providedToken = req.headers['x-setup-token'];

    if (!SETUP_TOKEN) {
      return res.status(403).json({ error: 'SETUP_SECRET_TOKEN non configure sur le serveur. Setup desactive.' });
    }

    if (typeof providedToken !== 'string' || !providedToken || !tokensMatch(providedToken, SETUP_TOKEN)) {
      return res.status(403).json({ error: 'Token de setup invalide' });
    }

    // Block if already configured
    const configured = await isAppConfigured();
    if (configured) {
      return res.status(403).json({ error: 'Application deja configuree. Utilisez le panneau admin pour modifier les parametres.' });
    }

    const { settings } = req.body;

    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ error: 'Un tableau de settings est requis' });
    }

    // Liste blanche stricte : le wizard ne peut ecrire que les reglages d'installation.
    const invalid = settings.find((s: any) =>
      !s || !isAllowedSettingKey(s.key, SETUP_KEYS) || typeof s.value !== 'string' || s.value.length > MAX_SETTING_LENGTH);
    if (invalid) {
      return res.status(400).json({ error: 'Reglage non autorise dans la configuration initiale' });
    }

    // Validate that all required keys are present
    for (const key of REQUIRED_KEYS) {
      const setting = settings.find((s: any) => s.key === key);
      if (!setting || !setting.value || setting.value.trim() === '') {
        return res.status(400).json({ error: `La cle ${key} est requise` });
      }
    }

    // Upsert each setting
    for (const s of settings) {
      if (!s.key || typeof s.value !== 'string') continue;

      // Try update first
      const { data: existing } = await supabaseAdmin
        .from('app_settings')
        .select('id')
        .eq('key', s.key)
        .single();

      if (existing) {
        await supabaseAdmin
          .from('app_settings')
          .update({
            value: s.value.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('key', s.key);
      } else {
        await supabaseAdmin
          .from('app_settings')
          .insert({
            key: s.key,
            value: s.value.trim(),
            updated_at: new Date().toISOString(),
          });
      }
    }

    return res.json({ message: 'Configuration initiale terminee avec succes' });
  } catch (error) {
    console.error('Setup configure error:', describeError(error));
    return res.status(500).json({ error: 'Erreur configuration initiale' });
  }
});

export default router;
