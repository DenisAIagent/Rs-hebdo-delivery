import { Router, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { AuthRequest } from '../middleware/auth';
import { correctText } from '../services/correction';

const router = Router();

// Dedicated rate limit for Claude API corrections (expensive)
const correctionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour window
  max: 30,                     // 30 corrections per hour per user
  keyGenerator: (req: AuthRequest) => req.userId || ipKeyGenerator(req.ip || ''),
  message: { error: 'Trop de corrections demandees. Reessayez dans quelques minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/correct - Correct text with the active AI provider
// Long features (sujet de couv) can legitimately take 30-90s — extend the socket timeout.
router.post('/', correctionLimiter, (req, _res, next) => { req.setTimeout(300_000); next(); }, async (req: AuthRequest, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Texte requis' });
  }

  if (text.length > 100000) {
    return res.status(400).json({ error: 'Texte trop long (max 100 000 signes)' });
  }

  try {
    const result = await correctText(text);
    return res.json(result);
  } catch (error: any) {
    console.error('Correction error:', error);
    const status = typeof error?.status === 'number' ? error.status : 500;
    return res.status(status >= 500 || status === 429 ? 503 : 500).json({
      error: 'Erreur lors de la correction',
      detail: error?.message || String(error),
      providerStatus: status,
    });
  }
});

export default router;
