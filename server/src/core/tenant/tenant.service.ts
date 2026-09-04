import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
}

@Injectable()
export class TenantService implements OnModuleInit {
  private readonly tenants = new Map<string, TenantRecord>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const rows = await this.persistence.load<TenantRecord[]>('tenants');
    if (rows?.length) {
      for (const t of rows) this.tenants.set(t.id, t);
    } else {
      await this.create({ code: 'default', name: 'Default Tenant' });
    }
  }

  private async persist() {
    await this.persistence.save('tenants', [...this.tenants.values()]);
  }

  async create(input: { code: string; name: string }): Promise<TenantRecord> {
    await this.ensureLoaded();
    const existing = this.findByCode(input.code);
    if (existing) return existing;
    const id = `tenant_${input.code}`;
    const record: TenantRecord = {
      id,
      code: input.code,
      name: input.name,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.tenants.set(id, record);
    await this.persist();
    return record;
  }

  findById(id: string): TenantRecord | undefined {
    return this.tenants.get(id);
  }

  findByCode(code: string): TenantRecord | undefined {
    return [...this.tenants.values()].find((t) => t.code === code);
  }

  list(): TenantRecord[] {
    return [...this.tenants.values()];
  }

  require(id: string): TenantRecord {
    const t = this.tenants.get(id);
    if (!t || !t.active) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return t;
  }
}
