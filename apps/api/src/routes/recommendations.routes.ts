import { Router } from 'express';

const router = Router();

router.get('/:id', (_req, res) => res.json({ message: 'get recommendation placeholder' }));
router.patch('/:id/status', (_req, res) => res.json({ message: 'update recommendation status placeholder' }));

export default router;
