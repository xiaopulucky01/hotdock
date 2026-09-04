import { Injectable, OnModuleInit } from '@nestjs/common';
import { PLATFORM_EVENTS } from '../contracts';
import { EventBusService } from '../event-bus/event-bus.service';
import { PersistenceService } from '../persistence/persistence.service';

export interface AuditEntry {
  id: string;
  action: string;
  module: string;
  actorId?: string;
  tenantId?: string;
  resource?: string;
  detail?: Record<string, unknown>;
  at: string;
}

@Injectable()
export class AuditService implements OnModuleInit {
  private entries: AuditEntry[] = [];
  private readonly max = 5000;
  private loaded = false;

  constructor(
    private readonly events: EventBusService,
    private readonly persistence: PersistenceService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    const rows = await this.persistence.load<AuditEntry[]>('audit');
    this.entries = rows ?? [];
    this.loaded = true;
  }

  private async persist() {
    await this.persistence.save(
      'audit',
      this.entries.slice(-this.max),
    );
  }

  record(input: Omit<AuditEntry, 'id' | 'at'> & { at?: Date | string }): AuditEntry {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at:
        typeof input.at === 'string'
          ? input.at
          : (input.at ?? new Date()).toISOString(),
      action: input.action,
      module: input.module,
      actorId: input.actorId,
      tenantId: input.tenantId,
      resource: input.resource,
      detail: input.detail,
    };
    this.entries.push(entry);
    if (this.entries.length > this.max) {
      this.entries = this.entries.slice(-this.max);
    }
    void this.persist();
    void this.events.emit({
      name: PLATFORM_EVENTS.AUDIT_RECORDED,
      source: 'platform.audit',
      payload: entry,
      occurredAt: new Date(entry.at),
    });
    return entry;
  }

  list(opts?: {
    module?: string;
    actorId?: string;
    tenantId?: string;
    limit?: number;
  }): AuditEntry[] {
    let list = this.entries;
    if (opts?.module) {
      list = list.filter((e) => e.module === opts.module);
    }
    if (opts?.actorId) {
      list = list.filter((e) => e.actorId === opts.actorId);
    }
    if (opts?.tenantId) {
      list = list.filter((e) => e.tenantId === opts.tenantId);
    }
    return list.slice(-(opts?.limit ?? 100));
  }
}
