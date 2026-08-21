import { Router } from 'express';
import { AuthService } from '../services/authService';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const response = await AuthService.register(req.body);
    res.status(201).json(response);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const response = await AuthService.login(req.body);
    res.json(response);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/google-login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }
    const response = await AuthService.googleLogin(idToken);
    res.json(response);
  } catch (e: any) {
    console.error('[Auth] Google login failed:', e.message);
    res.status(401).json({ error: e.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const response = await AuthService.refresh(req.body.refreshToken);
    res.json(response);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/invite', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const response = await AuthService.generateInviteCode(req.user!.id);
    res.json(response);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/pair', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const response = await AuthService.pair(req.user!.id, req.body.code);
    res.json(response);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/unpair', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await AuthService.unpair(req.user!.id, req.body.partnerId);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/push-token', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required' });
    }
    await AuthService.savePushToken(req.user!.id, token);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/locale', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { locale } = req.body;
    if (!locale || typeof locale !== 'string') {
      return res.status(400).json({ error: 'locale is required' });
    }
    await AuthService.updateLocale(req.user!.id, locale);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/account', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await AuthService.deleteAccount(req.user!.id);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/partnership/:partnerId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    await AuthService.deletePartnership(req.user!.id, req.params.partnerId);
    res.json({ status: 'ok' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
