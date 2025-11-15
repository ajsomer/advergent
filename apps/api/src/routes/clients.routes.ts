import { Router } from 'express';

const router = Router();

router.post('/', (_req, res) => res.json({ message: 'create client placeholder' }));
router.get('/', (_req, res) => res.json({ message: 'list clients placeholder' }));
router.get('/:id', (_req, res) => res.json({ message: 'get client placeholder' }));
router.patch('/:id', (_req, res) => res.json({ message: 'update client placeholder' }));
router.delete('/:id', (_req, res) => res.json({ message: 'delete client placeholder' }));

router.get('/:id/recommendations', (_req, res) => res.json({ message: 'client recommendations placeholder' }));
router.get('/:id/competitors', (_req, res) => res.json({ message: 'client competitors placeholder' }));
router.post('/:id/sync', (_req, res) => res.json({ message: 'manual sync placeholder' }));

export default router;
