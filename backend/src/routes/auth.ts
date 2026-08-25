import { Router, Response } from 'express';
import { supabaseAdmin } from '../utils/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/auth/profile - Get current user profile
// authMiddleware enforces: valid token, active account, and 2FA passed (AAL2)
router.get('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.userId!)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'Profil introuvable' });
    }

    return res.json({ user: { ...profile, email: req.userEmail } });
  } catch {
    return res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
