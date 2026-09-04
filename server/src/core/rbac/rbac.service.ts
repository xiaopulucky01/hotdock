import { Injectable, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';

export interface PermissionRecord {
  code: string;
  name: string;
  description?: string;
  module?: string;
}

export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  permissionCodes: string[];
  system?: boolean;
}

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly permissions = new Map<string, PermissionRecord>();
  private readonly roles = new Map<string, RoleRecord>();
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
    this.seedDefaults();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    const data = await this.persistence.load<{
      permissions: PermissionRecord[];
      roles: RoleRecord[];
    }>('rbac');
    if (data) {
      for (const p of data.permissions ?? []) this.permissions.set(p.code, p);
      for (const r of data.roles ?? []) this.roles.set(r.id, r);
    }
    this.loaded = true;
  }

  private seedDefaults() {
    this.registerPermissions('platform', [
      { code: 'platform.user.read', name: '查看用户' },
      { code: 'platform.user.write', name: '管理用户' },
      { code: 'platform.module.manage', name: '管理模块' },
      { code: 'platform.config.manage', name: '管理配置' },
      { code: 'platform.audit.read', name: '查看审计' },
    ]);

    if (!this.roles.has('role.admin')) {
      this.upsertRole({
        id: 'role.admin',
        code: 'admin',
        name: '管理员',
        permissionCodes: ['*'],
        system: true,
      });
    }
    if (!this.roles.has('role.user')) {
      this.upsertRole({
        id: 'role.user',
        code: 'user',
        name: '普通用户',
        permissionCodes: ['platform.user.read'],
        system: true,
      });
    }
  }

  private async persist() {
    await this.persistence.save('rbac', {
      permissions: [...this.permissions.values()],
      roles: [...this.roles.values()],
    });
  }

  registerPermissions(
    module: string,
    defs: Array<{ code: string; name: string; description?: string }>,
  ) {
    for (const def of defs) {
      this.permissions.set(def.code, { ...def, module });
    }
    void this.persist();
  }

  upsertRole(role: RoleRecord) {
    this.roles.set(role.id, role);
    void this.persist();
  }

  getRole(id: string): RoleRecord | undefined {
    return this.roles.get(id);
  }

  listPermissions(module?: string): PermissionRecord[] {
    const all = [...this.permissions.values()];
    return module ? all.filter((p) => p.module === module) : all;
  }

  listRoles(): RoleRecord[] {
    return [...this.roles.values()];
  }

  resolvePermissions(roleIds: string[]): string[] {
    const set = new Set<string>();
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (!role) continue;
      for (const code of role.permissionCodes) {
        set.add(code);
      }
    }
    return [...set];
  }

  hasPermission(granted: string[], required: string): boolean {
    if (granted.includes('*')) return true;
    if (granted.includes(required)) return true;
    const parts = required.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const wild = `${parts.slice(0, i).join('.')}.*`;
      if (granted.includes(wild)) return true;
    }
    return false;
  }
}
