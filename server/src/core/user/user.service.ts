import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PersistenceService } from '../persistence/persistence.service';
import { EventBusService } from '../event-bus/event-bus.service';
import { PLATFORM_EVENTS } from '../contracts';

export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  tenantId?: string;
  roleIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  tenantId?: string;
  roleIds?: string[];
}

@Injectable()
export class UserService implements OnModuleInit {
  private readonly users = new Map<string, UserRecord>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly events: EventBusService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const rows = await this.persistence.load<UserRecord[]>('users');
    if (rows?.length) {
      for (const u of rows) this.users.set(u.id, this.normalize(u));
    } else {
      await this.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@platform.local',
        roleIds: ['role.admin'],
      });
    }
  }

  private normalize(u: UserRecord): UserRecord {
    return {
      ...u,
      createdAt:
        typeof u.createdAt === 'string'
          ? u.createdAt
          : new Date(u.createdAt).toISOString(),
      updatedAt:
        typeof u.updatedAt === 'string'
          ? u.updatedAt
          : new Date(u.updatedAt).toISOString(),
    };
  }

  private async persist() {
    await this.persistence.save('users', [...this.users.values()]);
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    await this.ensureLoaded();
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const record: UserRecord = {
      id,
      username: input.username,
      email: input.email,
      passwordHash: await this.hash(input.password),
      tenantId: input.tenantId,
      roleIds: input.roleIds ?? ['role.user'],
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, record);
    await this.persist();
    void this.events.emit({
      name: PLATFORM_EVENTS.USER_CREATED,
      source: 'platform.user',
      payload: { id: record.id, username: record.username },
      tenantId: record.tenantId,
      occurredAt: new Date(),
    });
    return record;
  }

  findById(id: string): UserRecord | undefined {
    return this.users.get(id);
  }

  findByUsername(username: string): UserRecord | undefined {
    return [...this.users.values()].find((u) => u.username === username);
  }

  list(tenantId?: string): UserRecord[] {
    const all = [...this.users.values()];
    return tenantId ? all.filter((u) => u.tenantId === tenantId) : all;
  }

  async update(
    id: string,
    patch: Partial<Pick<UserRecord, 'email' | 'roleIds' | 'active' | 'tenantId'>>,
  ): Promise<UserRecord> {
    await this.ensureLoaded();
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const next = {
      ...user,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, next);
    await this.persist();
    void this.events.emit({
      name: PLATFORM_EVENTS.USER_UPDATED,
      source: 'platform.user',
      payload: { id },
      tenantId: next.tenantId,
      occurredAt: new Date(),
    });
    return next;
  }

  async verifyPassword(user: UserRecord, password: string): Promise<boolean> {
    if (user.passwordHash.startsWith('plain:')) {
      const ok = user.passwordHash === `plain:${password}`;
      if (ok) {
        // Upgrade legacy hash on successful login
        user.passwordHash = await this.hash(password);
        user.updatedAt = new Date().toISOString();
        this.users.set(user.id, user);
        await this.persist();
      }
      return ok;
    }
    return bcrypt.compare(password, user.passwordHash);
  }

  private async hash(value: string): Promise<string> {
    return bcrypt.hash(value, 10);
  }
}
