import { Injectable, ConflictException, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { CacheService } from '../cache/cache.service';

interface IdempotencyRecord {
  key: string;
  tenantId?: string;
  fingerprint: string;
  status: 'in_progress' | 'completed';
  response?: unknown;
  createdAt: string;
  expiresAt: string;
}

/**
 * Idempotency-Key store for mutating APIs (payments, orders, etc.).
 */
@Injectable()
export class IdempotencyService implements OnModuleInit {
  private readonly ttlMs = Number(process.env.IDEMPOTENCY_TTL_MS ?? 86_400_000);
  private records = new Map<string, IdempotencyRecord>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly cache: CacheService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private scopeKey(key: string, tenantId?: string) {
    return `${tenantId ?? 'global'}:${key}`;
  }

  private fingerprint(body: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(body ?? null))
      .digest('hex');
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<{
      records: IdempotencyRecord[];
    }>('idempotency');
    const now = Date.now();
    for (const r of data?.records ?? []) {
      if (new Date(r.expiresAt).getTime() > now) {
        this.records.set(this.scopeKey(r.key, r.tenantId), r);
      }
    }
  }

  private async persist() {
    await this.persistence.save('idempotency', {
      records: [...this.records.values()].slice(-5000),
    });
  }

  async begin(
    key: string,
    body: unknown,
    tenantId?: string,
  ): Promise<{ hit: true; response: unknown } | { hit: false }> {
    await this.ensureLoaded();
    const sk = this.scopeKey(key, tenantId);
    const cached = await this.cache.getAsync<IdempotencyRecord>(`idem:${sk}`);
    const existing = cached ?? this.records.get(sk);
    const fp = this.fingerprint(body);

    if (existing && new Date(existing.expiresAt).getTime() > Date.now()) {
      if (existing.fingerprint !== fp) {
        throw new ConflictException(
          'Idempotency-Key reused with different payload',
        );
      }
      if (existing.status === 'completed') {
        return { hit: true, response: existing.response };
      }
      throw new ConflictException('Request with this Idempotency-Key is in progress');
    }

    const now = new Date();
    const record: IdempotencyRecord = {
      key,
      tenantId,
      fingerprint: fp,
      status: 'in_progress',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
    };
    this.records.set(sk, record);
    await this.cache.setAsync(`idem:${sk}`, record, this.ttlMs);
    await this.persist();
    return { hit: false };
  }

  async complete(key: string, response: unknown, tenantId?: string) {
    await this.ensureLoaded();
    const sk = this.scopeKey(key, tenantId);
    const record = this.records.get(sk);
    if (!record) return;
    record.status = 'completed';
    record.response = response;
    this.records.set(sk, record);
    await this.cache.setAsync(`idem:${sk}`, record, this.ttlMs);
    await this.persist();
  }
}
