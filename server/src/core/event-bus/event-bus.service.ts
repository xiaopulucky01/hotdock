import { Injectable, Logger } from '@nestjs/common';
import { EventHandler, PlatformEvent } from '../contracts';

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly history: PlatformEvent[] = [];
  private readonly maxHistory = 500;

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

  async emit<T = unknown>(event: Omit<PlatformEvent<T>, 'occurredAt'> & { occurredAt?: Date }) {
    const full: PlatformEvent<T> = {
      ...event,
      occurredAt: event.occurredAt ?? new Date(),
    };
    this.history.push(full as PlatformEvent);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    const targets = [
      ...(this.handlers.get(full.name) ?? []),
      ...(this.handlers.get('*') ?? []),
    ];

    for (const handler of targets) {
      try {
        await handler(full);
      } catch (err) {
        this.logger.error(
          `Event handler failed for ${full.name}: ${(err as Error).message}`,
        );
      }
    }
    return full;
  }

  recent(limit = 50, name?: string): PlatformEvent[] {
    const list = name
      ? this.history.filter((e) => e.name === name)
      : this.history;
    return list.slice(-limit);
  }
}
