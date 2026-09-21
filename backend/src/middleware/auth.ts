import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../utils/supabase';
import { isMfaRequired } from '../services/mfaPolicy';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  accessToken?: string;
}

/**
 * Extract the Authenticator Assurance Level from a Supabase JWT.
 * 'aal1' = password only, 'aal2' = password + 2FA verified.
 */
function getTokenAal(token: string): string {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload?.aal || 'aal1';
  } catch {
    return 'aal1';
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // 2FA (si activee dans l'admin) : la session doit avoir passe la verification TOTP
    if (getTokenAal(token) !== 'aal2' && (await isMfaRequired())) {
      return res.status(401).json({ error: 'Verification 2FA requise', code: 'mfa_required' });
    }

    // Get profile with role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, is_active')
      .eq('id', user.id)
      .single();

    if (!profile?.is_active) {
      return res.status(403).json({ error: 'Compte desactive' });
    }

    req.userId = user.id;
    req.userEmail = user.email;
    req.userRole = profile?.role || 'journalist';
    req.accessToken = token;
    next();
  } catch {
    return res.status(401).json({ error: 'Erreur authentification' });
  }
}
