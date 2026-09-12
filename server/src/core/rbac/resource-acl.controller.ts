import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { ResourceAclService, AclAction } from './resource-acl.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class GrantDto {
  @IsString() resourceType!: string;
  @IsString() resourceId!: string;
  @IsString() subject!: string;
  @IsArray() @IsString({ each: true }) actions!: AclAction[];
  @IsOptional() @IsString() tenantId?: string;
}

@Controller('api/platform/acl')
@UseGuards(AuthGuard, PermissionsGuard)
export class ResourceAclController {
  constructor(private readonly acl: ResourceAclService) {}

  @Get()
  @RequirePermissions('platform.rbac.read')
  list(
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.acl.list({ resourceType, resourceId, tenantId });
  }

  @Post()
  @RequirePermissions('platform.rbac.write')
  grant(@Body() body: GrantDto) {
    return this.acl.grant(body);
  }

  @Delete()
  @RequirePermissions('platform.rbac.write')
  revoke(
    @Query('resourceType') resourceType: string,
    @Query('resourceId') resourceId: string,
    @Query('subject') subject: string,
  ) {
    this.acl.revoke(resourceType, resourceId, subject);
    return { ok: true };
  }
}
