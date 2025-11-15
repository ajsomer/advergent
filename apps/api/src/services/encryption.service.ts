import crypto from 'crypto';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { query } from '@/db';
import { logger } from '@/utils/logger';

class EncryptionService {
  private kmsClient: KMSClient;
  private keyCache = new Map<number, Buffer>();

  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
          }
        : undefined
    });
  }

  private async getDataKey(version?: number) {
    if (!version) {
      const latest = await query<{ key_version: number }>(
        `SELECT key_version FROM encryption_keys WHERE retired_at IS NULL ORDER BY created_at DESC LIMIT 1`
      );
      if (!latest.length) throw new Error('No encryption key configured');
      version = latest[0].key_version;
    }

    if (this.keyCache.has(version)) {
      return { key: this.keyCache.get(version)!, version };
    }

    const rows = await query<{ encrypted_key: string }>(
      `SELECT encrypted_key FROM encryption_keys WHERE key_version = $1`,
      [version]
    );
    if (!rows.length) throw new Error(`Key version ${version} not found`);

    const response = await this.kmsClient.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(rows[0].encrypted_key, 'base64'),
        KeyId: process.env.KMS_KEY_ID
      })
    );

    const key = Buffer.from(response.Plaintext || '');
    this.keyCache.set(version, key);
    return { key, version };
  }

  async encrypt(plaintext: string) {
    const { key, version } = await this.getDataKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
    logger.debug({ version }, 'data encrypted');
    return { encrypted: payload, keyVersion: version };
  }

  async decrypt(ciphertext: string, version: number) {
    const { key } = await this.getDataKey(version);
    const [ivB64, tagB64, dataB64] = ciphertext.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  }

  hash(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

export const encryptionService = new EncryptionService();
export const encryptToken = (token: string) => encryptionService.encrypt(token);
export const decryptToken = (payload: string, version: number) => encryptionService.decrypt(payload, version);
export const hashData = (value: string) => encryptionService.hash(value);
