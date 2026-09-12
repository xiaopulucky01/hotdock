import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventHandler, PlatformEvent } from '../contracts';
import { PersistenceService } from '../persistence/persistence.service';
import { NotificationService } from '../notification/notification.service';
import { OutboxService } from './outbox.service';

export interface DeadLetterEntry {
  event: PlatformEvent;
  error: string;
  attempts: number;
  at: string;
}

@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private history: PlatformEvent[] = [];
  private deadLetters: DeadLetterEntry[] = [];
  private readonly maxHistory = 1000;
  private readonly maxRetries = 2;
  private loaded = false;
  private useOutbox = process.env.EVENT_OUTBOX !== '0';
  private metrics = { emitted: 0, handlerErrors: 0 };

  constructor(
    private readonly persistence: PersistenceService,
    private readonly notifications: NotificationService,
    private readonly outbox: OutboxService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
    // Deliver outbox → in-process handlers + notifications
    this.outbox.registerTransport(async (event) => {
      await this.deliver(event);
    });
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    const data = await this.persistence.load<{
      history: PlatformEvent[];
      deadLetters: DeadLetterEntry[];
    }>('events');
    this.history = (data?.history ?? []).map((e) => ({
      ...e,
      occurredAt: new Date(e.occurredAt),
    }));
    this.deadLetters = data?.deadLetters ?? [];
    this.loaded = true;
  }

  private async persist() {
    await this.persistence.save('events', {
      history: this.history.slice(-this.maxHistory),
      deadLetters: this.deadLetters.slice(-200),
    });
  }

  on<T = unknown>(eventName: string, handler: EventHandler<T>) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler as EventHandler);
    return () => this.off(eventName, handler as EventHandler);
  }

  onAny(handler: EventHandler) {
    return this.on('*', handler);
  }

  off(eventName: string, handler: EventHandler) {
    this.handlers.get(eventName)?.delete(handler);
  }

  /**
   * Emit event. With outbox enabled (default), persists first then delivers async.
   * Set EVENT_OUTBOX=0 for sync in-process only (tests).
   */
  async emit<T = unknown>(
    event: Omit<PlatformEvent<T>, 'occurredAt'> & { occurredAt?: Date },
  ) {
    await this.ensureLoaded();
    const full: PlatformEvent<T> = {
      ...event,
      occurredAt: event.occurredAt ?? new Date(),
    };
    this.history.push(full as PlatformEvent);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    this.metrics.emitted += 1;
    void this.persist();

    if (this.useOutbox) {
      await this.outbox.enqueue(full as PlatformEvent);
      return full;
    }

    await this.deliver(full as PlatformEvent);
    return full;
  }

  private async deliver(full: PlatformEvent) {
    const targets = [
      ...(this.handlers.get(full.name) ?? []),
      ...(this.handlers.get('*') ?? []),
    ];

    for (const handler of targets) {
      let attempt = 0;
      let lastError: Error | undefined;
      while (attempt <= this.maxRetries) {
        try {
          await handler(full);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err as Error;
          attempt += 1;
          if (attempt <= this.maxRetries) {
            await new Promise((r) => setTimeout(r, 50 * attempt));
          }
        }
      }
      if (lastError) {
        this.logger.error(
          `Event handler failed for ${full.name} after ${attempt} attempts: ${lastError.message}`,
        );
        this.metrics.handlerErrors += 1;
        this.deadLetters.push({
          event: full,
          error: lastError.message,
          attempts: attempt,
          at: new Date().toISOString(),
        });
        if (this.deadLetters.length > 200) {
          this.deadLetters = this.deadLetters.slice(-200);
        }
      }
    }

    void this.notifications.dispatch(full.name, full.payload);
    void this.persist();
  }

  recent(limit = 50, name?: string): PlatformEvent[] {
    const list = name
      ? this.history.filter((e) => e.name === name)
      : this.history;
    return list.slice(-limit);
  }

  listDeadLetters(limit = 50) {
    return this.deadLetters.slice(-limit);
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
