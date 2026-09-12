import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface TenantModuleGrant {
  tenantId: string;
  /** If empty/undefined and denyAll=false → all enabled platform modules allowed */
  allow?: string[];
  deny?: string[];
  denyAll?: boolean;
}

/**
 * Per-tenant module allow/deny list on top of global enable/disable.
 */
@Injectable()
export class TenantModulesService implements OnModuleInit {
  private grants = new Map<string, TenantModuleGrant>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<TenantModuleGrant[]>(
      'tenant-modules',
    );
    for (const g of data ?? []) this.grants.set(g.tenantId, g);
  }

  private async persist() {
    await this.persistence.save('tenant-modules', [...this.grants.values()]);
  }

  get(tenantId: string): TenantModuleGrant {
    return this.grants.get(tenantId) ?? { tenantId };
  }

  set(tenantId: string, patch: Partial<Omit<TenantModuleGrant, 'tenantId'>>) {
    const next: TenantModuleGrant = {
      ...this.get(tenantId),
      ...patch,
      tenantId,
    };
    this.grants.set(tenantId, next);
    void this.persist();
    return next;
  }

  list() {
    return [...this.grants.values()];
  }

  isAllowed(tenantId: string | undefined, moduleName: string): boolean {
    if (!tenantId) return true;
    const g = this.get(tenantId);
    if (g.denyAll) return false;
    if (g.deny?.includes(moduleName)) return false;
    if (g.allow?.length) return g.allow.includes(moduleName);
    return true;
  }

  assertAllowed(tenantId: string | undefined, moduleName: string) {
    if (!this.isAllowed(tenantId, moduleName)) {
      throw new ForbiddenException(
        `Module "${moduleName}" is not licensed for this tenant`,
      );
    }
  }
}
