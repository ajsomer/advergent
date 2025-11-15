import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '@/middleware/validation.middleware';

const router = Router();

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post('/signup', validateBody(signupSchema), (_req, res) => {
  res.json({ message: 'signup endpoint placeholder' });
});

router.post('/login', validateBody(loginSchema), (_req, res) => {
  res.json({ message: 'login endpoint placeholder' });
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'logout endpoint placeholder' });
});

router.get('/me', (_req, res) => {
  res.json({ message: 'me endpoint placeholder' });
});

export default router;
