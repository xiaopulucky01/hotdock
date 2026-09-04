import { Injectable, OnModuleInit } from '@nestjs/common';

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

  onModuleInit() {
    this.registerPermissions('platform', [
      { code: 'platform.user.read', name: '查看用户' },
      { code: 'platform.user.write', name: '管理用户' },
      { code: 'platform.module.manage', name: '管理模块' },
      { code: 'platform.config.manage', name: '管理配置' },
      { code: 'platform.audit.read', name: '查看审计' },
    ]);

    this.upsertRole({
      id: 'role.admin',
      code: 'admin',
      name: '管理员',
      permissionCodes: ['*'],
      system: true,
    });

    this.upsertRole({
      id: 'role.user',
      code: 'user',
      name: '普通用户',
      permissionCodes: ['platform.user.read'],
      system: true,
    });
  }

  registerPermissions(
    module: string,
    defs: Array<{ code: string; name: string; description?: string }>,
  ) {
    for (const def of defs) {
      this.permissions.set(def.code, { ...def, module });
    }
  }

  upsertRole(role: RoleRecord) {
    this.roles.set(role.id, role);
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
    // wildcard: ecommerce.*
    const parts = required.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const wild = `${parts.slice(0, i).join('.')}.*`;
      if (granted.includes(wild)) return true;
    }
    return false;
  }
}
