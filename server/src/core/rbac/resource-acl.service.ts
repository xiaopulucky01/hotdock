import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { PersistenceService } from '../persistence/persistence.service';
import { AuthenticatedUser } from '../contracts';

export type AclAction = 'read' | 'write' | 'delete' | 'admin' | '*';

export interface ResourceAclEntry {
  /** resource type, e.g. "ai-chat.conversation" */
  resourceType: string;
  /** resource id or "*" */
  resourceId: string;
  /** subject user id, role code, or "tenant:<id>" */
  subject: string;
  actions: AclAction[];
  tenantId?: string;
}

/**
 * Resource-level ACL on top of RBAC permission strings.
 */
@Injectable()
export class ResourceAclService implements OnModuleInit {
  private entries: ResourceAclEntry[] = [];
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<ResourceAclEntry[]>('resource-acl');
    this.entries = data ?? [];
  }

  private async persist() {
    await this.persistence.save('resource-acl', this.entries);
  }

  grant(entry: ResourceAclEntry) {
    this.entries = this.entries.filter(
      (e) =>
        !(
          e.resourceType === entry.resourceType &&
          e.resourceId === entry.resourceId &&
          e.subject === entry.subject &&
          e.tenantId === entry.tenantId
        ),
    );
    this.entries.push(entry);
    void this.persist();
    return entry;
  }

  revoke(resourceType: string, resourceId: string, subject: string) {
    this.entries = this.entries.filter(
      (e) =>
        !(
          e.resourceType === resourceType &&
          e.resourceId === resourceId &&
          e.subject === subject
        ),
    );
    void this.persist();
  }

  list(filter?: {
    resourceType?: string;
    resourceId?: string;
    tenantId?: string;
  }) {
    return this.entries.filter((e) => {
      if (filter?.resourceType && e.resourceType !== filter.resourceType) {
        return false;
      }
      if (filter?.resourceId && e.resourceId !== filter.resourceId) {
        return false;
      }
      if (filter?.tenantId && e.tenantId !== filter.tenantId) return false;
      return true;
    });
  }

  can(
    user: AuthenticatedUser,
    resourceType: string,
    resourceId: string,
    action: AclAction,
  ): boolean {
    if (user.permissions.includes('*') || user.permissions.includes('platform.*')) {
      return true;
    }
    const subjects = [
      `user:${user.id}`,
      user.id,
      ...user.roles.map((r) => `role:${r}`),
      user.tenantId ? `tenant:${user.tenantId}` : undefined,
    ].filter(Boolean) as string[];

    const matches = this.entries.filter(
      (e) =>
        e.resourceType === resourceType &&
        (e.resourceId === resourceId || e.resourceId === '*') &&
        subjects.includes(e.subject) &&
        (!e.tenantId || e.tenantId === user.tenantId),
    );
    return matches.some(
      (e) =>
        e.actions.includes('*') ||
        e.actions.includes('admin') ||
        e.actions.includes(action),
    );
  }

  assert(
    user: AuthenticatedUser,
    resourceType: string,
    resourceId: string,
    action: AclAction,
  ) {
    if (!this.can(user, resourceType, resourceId, action)) {
      throw new ForbiddenException(
        `ACL denied: ${action} ${resourceType}/${resourceId}`,
      );
    }
  }
}
