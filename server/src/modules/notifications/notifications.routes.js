const { Router } = require('express');
const { z, parse, objectId } = require('../../shared/validate');
const service = require('./notifications.service');

// Inbox and phone-alert subscriptions, for every signed-in role. Mounted at /api/me.
const router = Router();

router.get('/notifications', async (req, res) => {
  res.json(await service.inbox(req.user));
});

router.post('/notifications/read', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(objectId).optional() }), req.body || {});
  res.json(await service.markRead(req.user, ids));
});

router.post('/push', async (req, res) => {
  const body = parse(z.object({ endpoint: z.url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }), req.body);
  res.json(await service.subscribe(req.user, body, req.get('user-agent')));
});

router.delete('/push', async (req, res) => {
  const { endpoint } = parse(z.object({ endpoint: z.string() }), req.body || {});
  res.json(await service.unsubscribe(req.user, endpoint));
});

module.exports = router;
