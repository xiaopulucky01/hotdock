import { Injectable, Logger } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[]; // event name or '*'
  active: boolean;
  secret?: string;
  createdAt: string;
}

export interface NotificationRecord {
  id: string;
  channel: 'webhook' | 'log';
  target: string;
  event: string;
  status: 'sent' | 'failed';
  error?: string;
  at: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private endpoints: WebhookEndpoint[] = [];
  private history: NotificationRecord[] = [];
  private readonly maxHistory = 500;
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async ensureLoaded() {
    if (this.loaded) return;
    const data = await this.persistence.load<{
      endpoints: WebhookEndpoint[];
      history: NotificationRecord[];
    }>('notifications');
    this.endpoints = data?.endpoints ?? [];
    this.history = data?.history ?? [];
    this.loaded = true;
  }

  private async persist() {
    await this.persistence.save('notifications', {
      endpoints: this.endpoints,
      history: this.history.slice(-this.maxHistory),
    });
  }

  async registerWebhook(input: {
    url: string;
    events: string[];
    secret?: string;
  }): Promise<WebhookEndpoint> {
    await this.ensureLoaded();
    const endpoint: WebhookEndpoint = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      url: input.url,
      events: input.events,
      secret: input.secret,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.endpoints.push(endpoint);
    await this.persist();
    return endpoint;
  }

  async listWebhooks() {
    await this.ensureLoaded();
    return this.endpoints;
  }

  async removeWebhook(id: string) {
    await this.ensureLoaded();
    this.endpoints = this.endpoints.filter((e) => e.id !== id);
    await this.persist();
  }

  async recent(limit = 50) {
    await this.ensureLoaded();
    return this.history.slice(-limit);
  }

  async dispatch(eventName: string, payload: unknown) {
    await this.ensureLoaded();
    const targets = this.endpoints.filter(
      (e) =>
        e.active &&
        (e.events.includes('*') || e.events.includes(eventName)),
    );
    for (const endpoint of targets) {
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(endpoint.secret
              ? { 'X-Webhook-Secret': endpoint.secret }
              : {}),
          },
          body: JSON.stringify({
            event: eventName,
            payload,
            occurredAt: new Date().toISOString(),
          }),
        });
        this.pushHistory({
          id: `ntf_${Date.now()}`,
          channel: 'webhook',
          target: endpoint.url,
          event: eventName,
          status: res.ok ? 'sent' : 'failed',
          error: res.ok ? undefined : `HTTP ${res.status}`,
          at: new Date().toISOString(),
        });
      } catch (err) {
        this.logger.warn(
          `Webhook ${endpoint.id} failed: ${(err as Error).message}`,
        );
        this.pushHistory({
          id: `ntf_${Date.now()}`,
          channel: 'webhook',
          target: endpoint.url,
          event: eventName,
          status: 'failed',
          error: (err as Error).message,
          at: new Date().toISOString(),
        });
      }
    }
    if (targets.length) await this.persist();
  }

  private pushHistory(entry: NotificationRecord) {
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }
}
