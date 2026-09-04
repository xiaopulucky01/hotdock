import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import {
  AuthTokens,
  AuthenticatedUser,
  AuthTokenPayload,
  LoginCredentials,
} from '../contracts';
import { UserService } from '../user/user.service';
import { RbacService } from '../rbac/rbac.service';

@Injectable()
export class IdentityService {
  /** In-memory token store — replace with JWT + Redis in production */
  private readonly tokens = new Map<
    string,
    { userId: string; expiresAt: number }
  >();

  private readonly accessTtlMs = 2 * 60 * 60 * 1000;

  constructor(
    private readonly users: UserService,
    private readonly rbac: RbacService,
  ) {}

  login(credentials: LoginCredentials): AuthTokens {
    const user = this.users.findByUsername(credentials.username);
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!this.users.verifyPassword(user, credentials.password)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      credentials.tenantId &&
      user.tenantId &&
      credentials.tenantId !== user.tenantId
    ) {
      throw new UnauthorizedException('Tenant mismatch');
    }

    const accessToken = `atk_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    this.tokens.set(accessToken, {
      userId: user.id,
      expiresAt: Date.now() + this.accessTtlMs,
    });

    return {
      accessToken,
      expiresIn: Math.floor(this.accessTtlMs / 1000),
      tokenType: 'Bearer',
    };
  }

  logout(token: string) {
    this.tokens.delete(token);
  }

  authenticate(token: string): AuthenticatedUser {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
    const entry = this.tokens.get(raw);
    if (!entry || entry.expiresAt < Date.now()) {
      this.tokens.delete(raw);
      throw new UnauthorizedException('Invalid or expired token');
    }
    const user = this.users.findById(entry.userId);
    if (!user || !user.active) {
      throw new UnauthorizedException('User inactive');
    }
    const permissions = this.rbac.resolvePermissions(user.roleIds);
    const roles = user.roleIds
      .map((id) => this.rbac.getRole(id)?.code)
      .filter((c): c is string => !!c);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      tenantId: user.tenantId,
      roles,
      permissions,
    };
  }

  decodePayload(user: AuthenticatedUser): AuthTokenPayload {
    return {
      sub: user.id,
      username: user.username,
      tenantId: user.tenantId,
      roles: user.roles,
    };
  }

  register(input: {
    username: string;
    password: string;
    email?: string;
    tenantId?: string;
  }) {
    if (this.users.findByUsername(input.username)) {
      throw new BadRequestException('Username already exists');
    }
    const user = this.users.create({
      username: input.username,
      password: input.password,
      email: input.email,
      tenantId: input.tenantId,
      roleIds: ['role.user'],
    });
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      tenantId: user.tenantId,
    };
  }
}
