import { Controller, Get, Query } from '@nestjs/common';
import { RbacService } from './rbac.service';

@Controller('api/platform/rbac')
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('permissions')
  permissions(@Query('module') module?: string) {
    return this.rbac.listPermissions(module);
  }

  @Get('roles')
  roles() {
    return this.rbac.listRoles();
  }
}
