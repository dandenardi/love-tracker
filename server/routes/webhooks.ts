import { Router } from 'express';
import { EntitlementService, RevenueCatWebhookPayload } from '../services/entitlementService';

const router = Router();

// RevenueCat calls this directly — no JWT (there's no logged-in user on this request).
// Auth is the shared secret configured as the "Authorization header value" in the
// RevenueCat dashboard (Project Settings → Integrations → Webhooks).
router.post('/revenuecat', async (req, res) => {
  try {
    const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[Webhooks] REVENUECAT_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }
    if (req.headers['authorization'] !== expectedSecret) {
      return res.status(401).json({ error: 'Invalid webhook authorization' });
    }

    const payload = req.body as RevenueCatWebhookPayload;
    if (!payload?.event?.app_user_id || !payload?.event?.type) {
      return res.status(400).json({ error: 'Malformed webhook payload' });
    }

    await EntitlementService.applyWebhookEvent(payload.event);
    res.json({ status: 'ok' });
  } catch (e: any) {
    console.error('[Webhooks] RevenueCat webhook error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
