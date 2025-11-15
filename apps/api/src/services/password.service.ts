import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 12;

export function validatePasswordStrength(password: string) {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) errors.push('Password needs an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password needs a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password needs a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password needs a special character');
  return { valid: errors.length === 0, errors };
}

export async function hashPassword(password: string) {
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return { hash, algorithm: 'bcrypt', cost: BCRYPT_ROUNDS };
}

export async function verifyPassword(password: string, hash: string, algorithm = 'bcrypt') {
  if (algorithm !== 'bcrypt') throw new Error(`Unsupported algorithm ${algorithm}`);
  return bcrypt.compare(password, hash);
}

export function needsRehash(hash: string) {
  const rounds = parseInt(hash.split('$')[2], 10);
  return rounds < BCRYPT_ROUNDS;
}
