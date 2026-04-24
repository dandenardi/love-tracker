import { Router } from 'express';
import { SyncService } from '../services/syncService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.post('/push', async (req: AuthRequest, res) => {
  try {
    await SyncService.pushEvents(req.user!.id, req.body.events);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/pull', async (req: AuthRequest, res) => {
  try {
    const lastPulledAt = Number(req.query.lastPulledAt) || 0;
    const response = await SyncService.pullEvents(req.user!.id, lastPulledAt);
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:clientId', async (req: AuthRequest, res) => {
  try {
    await SyncService.deleteEvent(req.user!.id, req.params.clientId);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
