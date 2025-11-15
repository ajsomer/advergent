import { Router } from 'express';

const router = Router();

router.get('/auth-url', (_req, res) => res.json({ message: 'google auth url placeholder' }));
router.get('/callback', (_req, res) => res.json({ message: 'google oauth callback placeholder' }));

export default router;
