import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';

const PREFIX = 'enc:v1:';

/**
 * AES-256-GCM secret encryption for config values and plugin secrets.
 * Key from SECRETS_MASTER_KEY (32+ chars) or derived from JWT_SECRET.
 */
@Injectable()
export class SecretsService implements OnModuleInit {
  private readonly logger = new Logger(SecretsService.name);
  private key!: Buffer;

  constructor(private readonly persistence: PersistenceService) {}

  onModuleInit() {
    const raw =
      process.env.SECRETS_MASTER_KEY ??
      process.env.JWT_SECRET ??
      'dev-platform-secret-change-me';
    this.key = createHash('sha256').update(raw).digest();
    if (!process.env.SECRETS_MASTER_KEY && !process.env.JWT_SECRET) {
      this.logger.warn(
        'Using default secrets key — set SECRETS_MASTER_KEY in production',
      );
    }
  }

  isEncrypted(value: string) {
    return value.startsWith(PREFIX);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return (
      PREFIX +
      Buffer.concat([iv, tag, enc]).toString('base64url')
    );
  }

  decrypt(ciphertext: string): string {
    if (!this.isEncrypted(ciphertext)) return ciphertext;
    const buf = Buffer.from(ciphertext.slice(PREFIX.length), 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Encrypt if not already; leave non-strings untouched. */
  seal(value: unknown): unknown {
    if (typeof value !== 'string' || !value || this.isEncrypted(value)) {
      return value;
    }
    return this.encrypt(value);
  }

  reveal(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
      return this.decrypt(value);
    } catch {
      return value;
    }
  }
}
