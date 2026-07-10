import { Router } from 'express';
import { InsightService } from '../services/insightService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/consent', async (req: AuthRequest, res) => {
  try {
    const { optIn } = req.body;
    if (typeof optIn !== 'boolean') {
      return res.status(400).json({ error: 'optIn must be a boolean' });
    }
    await InsightService.setOptIn(req.user!.id, optIn);
    res.json({ status: 'ok', optIn });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:domain', async (req: AuthRequest, res) => {
  try {
    const { domain } = req.params;
    if (domain !== 'solo' && domain !== 'couple') {
      return res.status(400).json({ error: 'domain must be "solo" or "couple"' });
    }
    const locale = (req.query.locale as string) || 'en';
    const outcome = await InsightService.generateOrGetInsight(req.user!.id, domain, locale);
    res.json(outcome);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
