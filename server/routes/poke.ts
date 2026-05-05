import { Router } from 'express';
import { PokeService } from '../services/pokeService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/**
 * POST /poke
 * Body: { partnerId: string, message: string, emoji: string }
 * Sends a poke to the specified partner.
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    await PokeService.sendPoke(req.user!.id, req.body);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * GET /pokes?since=<timestamp>
 * Returns pokes received by the authenticated user since the given timestamp.
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const since = Number(req.query.since) || 0;
    const pokes = await PokeService.getPokes(req.user!.id, since);
    res.json({ pokes });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /poke/:pokeId/read
 * Marks a poke as read.
 */
router.patch('/:pokeId/read', async (req: AuthRequest, res) => {
  try {
    await PokeService.markRead(req.user!.id, req.params.pokeId);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
