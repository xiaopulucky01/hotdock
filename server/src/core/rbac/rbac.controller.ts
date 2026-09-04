import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/rbac')
@UseGuards(AuthGuard, PermissionsGuard)
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('permissions')
  @RequirePermissions('platform.user.read')
  permissions(@Query('module') module?: string) {
    return this.rbac.listPermissions(module);
  }

  @Get('roles')
  @RequirePermissions('platform.user.read')
  roles() {
    return this.rbac.listRoles();
  }
}
