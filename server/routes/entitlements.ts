import { Router } from 'express';
import { EntitlementService } from '../services/entitlementService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/me', async (req: AuthRequest, res) => {
  try {
    const status = await EntitlementService.getStatus(req.user!.id);
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
