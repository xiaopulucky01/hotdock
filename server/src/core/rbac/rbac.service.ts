import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
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

export interface CreateRoleInput {
  code: string;
  name: string;
  permissionCodes?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  permissionCodes?: string[];
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
      { code: 'platform.tenant.read', name: '查看租户' },
      {
        code: 'platform.tenant.create',
        name: '创建租户',
        description: '平台开户：创建公司/组织，普通员工不可拥有',
      },
      { code: 'platform.module.manage', name: '管理模块' },
      { code: 'platform.config.manage', name: '管理配置' },
      { code: 'platform.audit.read', name: '查看审计' },
      { code: 'platform.rbac.manage', name: '管理角色权限' },
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

  getRoleByCode(code: string): RoleRecord | undefined {
    return [...this.roles.values()].find((r) => r.code === code);
  }

  listPermissions(module?: string): PermissionRecord[] {
    const all = [...this.permissions.values()];
    return module ? all.filter((p) => p.module === module) : all;
  }

  listRoles(): RoleRecord[] {
    return [...this.roles.values()];
  }

  createRole(input: CreateRoleInput): RoleRecord {
    const code = input.code.trim();
    const name = input.name.trim();
    if (!code || !name) {
      throw new BadRequestException('code and name are required');
    }
    if (!/^[a-z][a-z0-9._-]*$/i.test(code)) {
      throw new BadRequestException(
        'code must start with a letter and contain only letters, digits, ., _, -',
      );
    }
    if (this.getRoleByCode(code)) {
      throw new BadRequestException(`Role code "${code}" already exists`);
    }
    const permissionCodes = this.normalizePermissionCodes(
      input.permissionCodes ?? [],
    );
    const role: RoleRecord = {
      id: `role.${code}`,
      code,
      name,
      permissionCodes,
      system: false,
    };
    this.roles.set(role.id, role);
    void this.persist();
    return role;
  }

  updateRole(id: string, patch: UpdateRoleInput): RoleRecord {
    const role = this.roles.get(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    const next: RoleRecord = { ...role };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new BadRequestException('name cannot be empty');
      next.name = name;
    }
    if (patch.permissionCodes !== undefined) {
      next.permissionCodes = this.normalizePermissionCodes(
        patch.permissionCodes,
      );
      // Keep admin wildcard if this is the system admin role
      if (role.id === 'role.admin' && !next.permissionCodes.includes('*')) {
        next.permissionCodes = ['*', ...next.permissionCodes];
      }
    }
    this.roles.set(id, next);
    void this.persist();
    return next;
  }

  deleteRole(id: string): void {
    const role = this.roles.get(id);
    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }
    if (role.system) {
      throw new BadRequestException(`Cannot delete system role "${role.code}"`);
    }
    this.roles.delete(id);
    void this.persist();
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

  private normalizePermissionCodes(codes: string[]): string[] {
    const unique = [...new Set(codes.map((c) => c.trim()).filter(Boolean))];
    for (const code of unique) {
      if (code === '*') continue;
      if (!this.permissions.has(code)) {
        throw new BadRequestException(`Unknown permission "${code}"`);
      }
    }
    return unique;
  }
}
