import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { ModuleRegistryService } from '../module-registry/module-registry.service';
import { TenantModulesService } from '../tenant/tenant-modules.service';
import { REQUIRE_MODULE_KEY } from './public.decorator';

@Injectable()
export class ModuleEnabledGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRef: ModuleRef,
    @Optional() private readonly tenantModules?: TenantModulesService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const moduleName = this.reflector.getAllAndOverride<string>(
      REQUIRE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleName) return true;
    const registry = this.moduleRef.get(ModuleRegistryService, {
      strict: false,
    });
    if (!registry?.isEnabled(moduleName)) {
      throw new ForbiddenException(`Module "${moduleName}" is not enabled`);
    }

    const req = context.switchToHttp().getRequest<{
      tenantId?: string;
      user?: { tenantId?: string };
      headers?: Record<string, string | undefined>;
    }>();
    const tenantId =
      req.tenantId ??
      req.user?.tenantId ??
      req.headers?.['x-tenant-id'];
    this.tenantModules?.assertAllowed(tenantId, moduleName);
    return true;
  }
}
