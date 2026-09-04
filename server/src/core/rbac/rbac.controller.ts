import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { RbacService } from './rbac.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class CreateRoleDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes?: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes?: string[];
}

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

  @Get('roles/:id')
  @RequirePermissions('platform.user.read')
  getRole(@Param('id') id: string) {
    return this.rbac.getRole(id) ?? null;
  }

  @Post('roles')
  @RequirePermissions('platform.rbac.manage')
  createRole(@Body() body: CreateRoleDto) {
    return this.rbac.createRole(body);
  }

  @Patch('roles/:id')
  @RequirePermissions('platform.rbac.manage')
  updateRole(@Param('id') id: string, @Body() body: UpdateRoleDto) {
    return this.rbac.updateRole(id, body);
  }

  @Delete('roles/:id')
  @RequirePermissions('platform.rbac.manage')
  deleteRole(@Param('id') id: string) {
    this.rbac.deleteRole(id);
    return { ok: true };
  }
}
