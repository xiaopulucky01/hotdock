import { Injectable, NotFoundException } from '@nestjs/common';

export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

@Injectable()
export class TenantService {
  private readonly tenants = new Map<string, TenantRecord>();

  constructor() {
    this.create({ code: 'default', name: 'Default Tenant' });
  }

  create(input: { code: string; name: string }): TenantRecord {
    const id = `tenant_${input.code}`;
    const record: TenantRecord = {
      id,
      code: input.code,
      name: input.name,
      active: true,
      createdAt: new Date(),
    };
    this.tenants.set(id, record);
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
