import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../contracts';
import { TenantService } from '../tenant/tenant.service';
import { SKIP_TENANT_KEY } from './public.decorator';

export const TENANT_HEADER = 'x-tenant-id';

/**
 * Resolves tenant from header or authenticated user.
 * Enforces tenant match when both are present.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenants: TenantService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
      tenantId?: string;
    }>();

    const headerTenant =
      req.headers[TENANT_HEADER] ?? req.headers['x-tenant-code'];
    let tenantId = headerTenant;

    if (tenantId) {
      const byId = this.tenants.findById(tenantId);
      const byCode = byId ? undefined : this.tenants.findByCode(tenantId);
      const tenant = byId ?? byCode;
      if (!tenant || !tenant.active) {
        throw new ForbiddenException(`Unknown or inactive tenant: ${tenantId}`);
      }
      tenantId = tenant.id;
    } else if (req.user?.tenantId) {
      tenantId = req.user.tenantId;
    }

    if (
      req.user?.tenantId &&
      tenantId &&
      req.user.tenantId !== tenantId &&
      !req.user.permissions.includes('*') &&
      !req.user.roles.includes('admin')
    ) {
      throw new ForbiddenException('Tenant mismatch');
    }

    req.tenantId = tenantId;
    return true;
  }
}
