import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import {
  AuthGuard,
  CurrentTenant,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/users')
@UseGuards(AuthGuard, PermissionsGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  @RequirePermissions('platform.user.read')
  list(
    @Query('tenantId') tenantId?: string,
    @CurrentTenant() ctxTenant?: string,
  ) {
    const scope = tenantId ?? ctxTenant;
    return this.users.list(scope).map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      tenantId: u.tenantId,
      roleIds: u.roleIds,
      active: u.active,
      createdAt: u.createdAt,
    }));
  }

  @Get(':id')
  @RequirePermissions('platform.user.read')
  get(@Param('id') id: string) {
    const u = this.users.findById(id);
    if (!u) {
      return null;
    }
    return {
      id: u.id,
      username: u.username,
      email: u.email,
      tenantId: u.tenantId,
      roleIds: u.roleIds,
      active: u.active,
      createdAt: u.createdAt,
    };
  }
}
