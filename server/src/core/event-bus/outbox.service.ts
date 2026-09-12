import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { PlatformEvent } from '../contracts';
import { LockService } from '../distributed/lock.service';

export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export interface OutboxEntry {
  id: string;
  event: PlatformEvent;
  status: OutboxStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export type OutboxTransport = (event: PlatformEvent) => Promise<void>;

/**
 * Durable outbox: persist first, then deliver via in-process handlers
 * and optional external transport (MQ adapter).
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private entries: OutboxEntry[] = [];
  private transports: OutboxTransport[] = [];
  private timer?: NodeJS.Timeout;
  private loaded = false;
  private readonly maxAttempts = 8;
  /** In-process reentrancy guard — avoids lock spam when many emits race flush. */
  private flushing = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly locks: LockService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
    this.timer = setInterval(() => void this.flush(), 2000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  registerTransport(transport: OutboxTransport) {
    this.transports.push(transport);
    return () => {
      this.transports = this.transports.filter((t) => t !== transport);
    };
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<{ entries: OutboxEntry[] }>(
      'event-outbox',
    );
    this.entries = data?.entries ?? [];
  }

  private async persist() {
    await this.persistence.save('event-outbox', {
      entries: this.entries.slice(-2000),
    });
  }

  async enqueue(
    event: Omit<PlatformEvent, 'occurredAt'> & { occurredAt?: Date },
  ): Promise<OutboxEntry> {
    await this.ensureLoaded();
    const full: PlatformEvent = {
      ...event,
      occurredAt: event.occurredAt ?? new Date(),
    };
    const entry: OutboxEntry = {
      id: randomUUID(),
      event: {
        ...full,
        occurredAt: full.occurredAt,
      },
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // serialize Date for JSON
    (entry.event as { occurredAt: Date | string }).occurredAt =
      full.occurredAt instanceof Date
        ? full.occurredAt.toISOString()
        : (full.occurredAt as unknown as string);
    this.entries.push(entry);
    await this.persist();
    // Kick a flush soon without blocking emit; coalesced by flushing flag
    void this.flush();
    return entry;
  }

  list(status?: OutboxStatus, limit = 50) {
    const list = status
      ? this.entries.filter((e) => e.status === status)
      : this.entries;
    return list.slice(-limit);
  }

  async flush() {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const lock = await this.locks.acquire('outbox:flush', 10_000);
      if (!lock) return;
      try {
        await this.ensureLoaded();
        const pending = this.entries.filter(
          (e) => e.status === 'pending' || e.status === 'failed',
        );
        for (const entry of pending.slice(0, 50)) {
          if (entry.attempts >= this.maxAttempts) continue;
          entry.status = 'processing';
          entry.attempts += 1;
          entry.updatedAt = new Date().toISOString();
          try {
            const event: PlatformEvent = {
              ...entry.event,
              occurredAt: new Date(entry.event.occurredAt as unknown as string),
            };
            for (const transport of this.transports) {
              await transport(event);
            }
            entry.status = 'published';
            entry.lastError = undefined;
          } catch (err) {
            entry.status = 'failed';
            entry.lastError = (err as Error).message;
            this.logger.warn(
              `Outbox ${entry.id} failed: ${entry.lastError}`,
            );
          }
          entry.updatedAt = new Date().toISOString();
        }
        await this.persist();
      } finally {
        await lock.release();
      }
    } finally {
      this.flushing = false;
    }
  }
}
