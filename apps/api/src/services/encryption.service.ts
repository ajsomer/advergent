import crypto from 'crypto';
import { logger } from '@/utils/logger';

class EncryptionService {
  private masterKey: Buffer;
  private readonly CURRENT_VERSION = 1;

  constructor() {
    const keyHex = process.env.ENCRYPTION_MASTER_KEY;
    if (!keyHex) {
      throw new Error('ENCRYPTION_MASTER_KEY environment variable is required');
    }
    if (keyHex.length !== 64) {
      throw new Error('ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes)');
    }
    this.masterKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM
   * Returns encrypted payload with version for future key rotation support
   */
  async encrypt(plaintext: string) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData (all base64)
    const payload = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;

    logger.debug({ version: this.CURRENT_VERSION }, 'data encrypted');
    return { encrypted: payload, keyVersion: this.CURRENT_VERSION };
  }

  /**
   * Decrypts ciphertext using AES-256-GCM
   * Version parameter allows for future key rotation
   */
  async decrypt(ciphertext: string, version: number = this.CURRENT_VERSION) {
    if (version !== this.CURRENT_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const [ivB64, tagB64, dataB64] = ciphertext.split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid ciphertext format');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.masterKey, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * Creates SHA-256 hash of value (for non-reversible hashing)
   */
  hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
export const encryptToken = (token: string) => encryptionService.encrypt(token);
export const decryptToken = (payload: string, version?: number) => encryptionService.decrypt(payload, version);
export const hashData = (value: string) => encryptionService.hash(value);
