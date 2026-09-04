import { Injectable, NotFoundException } from '@nestjs/common';

export interface UserRecord {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  tenantId?: string;
  roleIds: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  tenantId?: string;
  roleIds?: string[];
}

@Injectable()
export class UserService {
  private readonly users = new Map<string, UserRecord>();

  constructor() {
    // Bootstrap admin for local/dev platforms
    this.create({
      username: 'admin',
      password: 'admin123',
      email: 'admin@platform.local',
      roleIds: ['role.admin'],
    });
  }

  create(input: CreateUserInput): UserRecord {
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const record: UserRecord = {
      id,
      username: input.username,
      email: input.email,
      passwordHash: this.hash(input.password),
      tenantId: input.tenantId,
      roleIds: input.roleIds ?? ['role.user'],
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, record);
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

  update(
    id: string,
    patch: Partial<Pick<UserRecord, 'email' | 'roleIds' | 'active'>>,
  ): UserRecord {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    const next = { ...user, ...patch, updatedAt: new Date() };
    this.users.set(id, next);
    return next;
  }

  verifyPassword(user: UserRecord, password: string): boolean {
    return user.passwordHash === this.hash(password);
  }

  /** Placeholder hash — replace with bcrypt/argon2 in production */
  private hash(value: string): string {
    return `plain:${value}`;
  }
}
