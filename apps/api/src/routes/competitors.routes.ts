import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.json({ message: 'list competitors placeholder' }));
router.post('/', (_req, res) => res.json({ message: 'create competitor placeholder' }));
router.patch('/:id', (_req, res) => res.json({ message: 'update competitor placeholder' }));
router.delete('/:id', (_req, res) => res.json({ message: 'delete competitor placeholder' }));

router.get('/:id/alerts', (_req, res) => res.json({ message: 'competitor alerts placeholder' }));
router.patch('/alerts/:id/status', (_req, res) => res.json({ message: 'update alert placeholder' }));

export default router;
