import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ message: 'agency info placeholder' });
});

router.patch('/', (_req, res) => {
  res.json({ message: 'update agency placeholder' });
});

export default router;
