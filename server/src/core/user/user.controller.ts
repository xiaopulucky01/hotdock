import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('api/platform/users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get()
  list(@Query('tenantId') tenantId?: string) {
    return this.users.list(tenantId).map((u) => ({
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
