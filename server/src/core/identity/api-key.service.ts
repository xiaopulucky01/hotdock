import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { RbacService } from '../rbac/rbac.service';
import { AuthenticatedUser } from '../contracts';
import { AuditService } from '../audit/audit.service';

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** sha256 of secret */
  hash: string;
  prefix: string;
  tenantId?: string;
  roleIds: string[];
  /** Service account subject */
  subject: string;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
}

@Injectable()
export class ApiKeyService implements OnModuleInit {
  private keys = new Map<string, ApiKeyRecord>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const rows = await this.persistence.load<ApiKeyRecord[]>('api-keys');
    for (const k of rows ?? []) this.keys.set(k.id, k);
  }

  private async persist() {
    await this.persistence.save('api-keys', [...this.keys.values()]);
  }

  private hash(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  async create(input: {
    name: string;
    tenantId?: string;
    roleIds?: string[];
    subject?: string;
  }) {
    await this.ensureLoaded();
    const secret = `hdk_${randomBytes(24).toString('base64url')}`;
    const id = `key_${randomBytes(8).toString('hex')}`;
    const record: ApiKeyRecord = {
      id,
      name: input.name,
      hash: this.hash(secret),
      prefix: secret.slice(0, 10),
      tenantId: input.tenantId,
      roleIds: input.roleIds ?? ['role.user'],
      subject: input.subject ?? `sa:${id}`,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.keys.set(id, record);
    await this.persist();
    this.audit.record({
      module: 'platform.identity',
      action: 'apikey.create',
      resource: id,
      tenantId: input.tenantId,
    });
    return { ...record, secret, hash: undefined };
  }

  list(tenantId?: string) {
    return [...this.keys.values()]
      .filter((k) => !tenantId || k.tenantId === tenantId)
      .map(({ hash: _h, ...rest }) => rest);
  }

  async revoke(id: string) {
    const key = this.keys.get(id);
    if (!key) throw new NotFoundException(`API key ${id} not found`);
    key.active = false;
    await this.persist();
    return { ok: true };
  }

  authenticate(raw: string): AuthenticatedUser {
    const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
    if (!token.startsWith('hdk_')) {
      throw new UnauthorizedException('Invalid API key');
    }
    const hash = this.hash(token);
    const key = [...this.keys.values()].find(
      (k) => k.active && k.hash === hash,
    );
    if (!key) throw new UnauthorizedException('Invalid API key');
    key.lastUsedAt = new Date().toISOString();
    void this.persist();
    const permissions = this.rbac.resolvePermissions(key.roleIds);
    return {
      id: key.subject,
      username: key.name,
      tenantId: key.tenantId,
      roles: key.roleIds,
      permissions,
      kind: 'api_key',
    };
  }

  tryAuthenticate(raw: string): AuthenticatedUser | null {
    try {
      return this.authenticate(raw);
    } catch {
      return null;
    }
  }
}
