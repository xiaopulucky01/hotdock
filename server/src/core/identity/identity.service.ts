import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import {
  AuthTokens,
  AuthenticatedUser,
  AuthTokenPayload,
  LoginCredentials,
} from '../contracts';
import { UserService } from '../user/user.service';
import { RbacService } from '../rbac/rbac.service';
import { PersistenceService } from '../persistence/persistence.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class IdentityService implements OnModuleInit {
  private readonly jwtSecret =
    process.env.JWT_SECRET ?? 'dev-platform-secret-change-me';
  private readonly accessTtlSec = Number(process.env.JWT_ACCESS_TTL ?? 7200);
  private readonly refreshTtlSec = Number(
    process.env.JWT_REFRESH_TTL ?? 60 * 60 * 24 * 7,
  );
  private revoked = new Set<string>();
  private loaded = false;

  constructor(
    private readonly users: UserService,
    private readonly rbac: RbacService,
    private readonly persistence: PersistenceService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    const data = await this.persistence.load<{ revoked: string[] }>(
      'auth-revoked',
    );
    this.revoked = new Set(data?.revoked ?? []);
    this.loaded = true;
  }

  private async persistRevoked() {
    await this.persistence.save('auth-revoked', {
      revoked: [...this.revoked].slice(-5000),
    });
  }

  async login(credentials: LoginCredentials): Promise<AuthTokens> {
    await this.ensureLoaded();
    const user = this.users.findByUsername(credentials.username);
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await this.users.verifyPassword(user, credentials.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (
      credentials.tenantId &&
      user.tenantId &&
      credentials.tenantId !== user.tenantId
    ) {
      throw new UnauthorizedException('Tenant mismatch');
    }

    const tokens = this.issueTokens(user.id, user.username, user.tenantId, user.roleIds);
    this.audit.record({
      module: 'platform.identity',
      action: 'auth.login',
      actorId: user.id,
      tenantId: user.tenantId,
    });
    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    await this.ensureLoaded();
    const payload = this.verifyToken(refreshToken, 'refresh');
    const user = this.users.findById(payload.sub);
    if (!user || !user.active) {
      throw new UnauthorizedException('User inactive');
    }
    this.revoked.add(payload.jti);
    await this.persistRevoked();
    return this.issueTokens(
      user.id,
      user.username,
      user.tenantId,
      user.roleIds,
    );
  }

  async logout(token: string) {
    await this.ensureLoaded();
    try {
      const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
      const payload = this.verifyToken(raw, 'access');
      this.revoked.add(payload.jti);
      await this.persistRevoked();
      this.audit.record({
        module: 'platform.identity',
        action: 'auth.logout',
        actorId: payload.sub,
        tenantId: payload.tenantId,
      });
    } catch {
      // ignore invalid token on logout
    }
  }

  authenticate(token: string): AuthenticatedUser {
    if (!token) {
      throw new UnauthorizedException('Missing token');
    }
    const raw = token.startsWith('Bearer ') ? token.slice(7) : token;
    const payload = this.verifyToken(raw, 'access');
    const user = this.users.findById(payload.sub);
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
      type: 'access',
      jti: '',
    };
  }

  async register(input: {
    username: string;
    password: string;
    email?: string;
    tenantId?: string;
  }) {
    if (this.users.findByUsername(input.username)) {
      throw new BadRequestException('Username already exists');
    }
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const user = await this.users.create({
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

  private issueTokens(
    userId: string,
    username: string,
    tenantId: string | undefined,
    roleIds: string[],
  ): AuthTokens {
    const roles = roleIds
      .map((id) => this.rbac.getRole(id)?.code)
      .filter((c): c is string => !!c);

    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessPayload: AuthTokenPayload = {
      sub: userId,
      username,
      tenantId,
      roles,
      type: 'access',
      jti: accessJti,
    };
    const refreshPayload: AuthTokenPayload = {
      ...accessPayload,
      type: 'refresh',
      jti: refreshJti,
    };

    const accessToken = jwt.sign(accessPayload, this.jwtSecret, {
      expiresIn: this.accessTtlSec,
    } as jwt.SignOptions);
    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, {
      expiresIn: this.refreshTtlSec,
    } as jwt.SignOptions);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSec,
      tokenType: 'Bearer',
    };
  }

  private verifyToken(
    token: string,
    expected: 'access' | 'refresh',
  ): AuthTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;
      if (payload.type !== expected) {
        throw new UnauthorizedException('Invalid token type');
      }
      if (this.revoked.has(payload.jti)) {
        throw new UnauthorizedException('Token revoked');
      }
      return payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
