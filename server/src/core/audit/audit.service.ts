import { Injectable } from '@nestjs/common';
import { PLATFORM_EVENTS } from '../contracts';
import { EventBusService } from '../event-bus/event-bus.service';

export interface AuditEntry {
  id: string;
  action: string;
  module: string;
  actorId?: string;
  tenantId?: string;
  resource?: string;
  detail?: Record<string, unknown>;
  at: Date;
}

@Injectable()
export class AuditService {
  private readonly entries: AuditEntry[] = [];
  private readonly max = 2000;

  constructor(private readonly events: EventBusService) {}

  record(input: Omit<AuditEntry, 'id' | 'at'> & { at?: Date }): AuditEntry {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: input.at ?? new Date(),
      action: input.action,
      module: input.module,
      actorId: input.actorId,
      tenantId: input.tenantId,
      resource: input.resource,
      detail: input.detail,
    };
    this.entries.push(entry);
    if (this.entries.length > this.max) {
      this.entries.shift();
    }
    void this.events.emit({
      name: PLATFORM_EVENTS.AUDIT_RECORDED,
      source: 'platform.audit',
      payload: entry,
      occurredAt: entry.at,
    });
    return entry;
  }

  list(opts?: {
    module?: string;
    actorId?: string;
    limit?: number;
  }): AuditEntry[] {
    let list = this.entries;
    if (opts?.module) {
      list = list.filter((e) => e.module === opts.module);
    }
    if (opts?.actorId) {
      list = list.filter((e) => e.actorId === opts.actorId);
    }
    return list.slice(-(opts?.limit ?? 100));
  }
}
