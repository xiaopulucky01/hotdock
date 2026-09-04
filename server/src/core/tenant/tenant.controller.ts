import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { TenantService } from './tenant.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class CreateTenantDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}

@Controller('api/platform/tenants')
@UseGuards(AuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  @RequirePermissions('platform.user.read')
  list() {
    return this.tenants.list();
  }

  @Get(':id')
  @RequirePermissions('platform.user.read')
  get(@Param('id') id: string) {
    return this.tenants.require(id);
  }

  @Post()
  @RequirePermissions('platform.user.write')
  create(@Body() body: CreateTenantDto) {
    return this.tenants.create(body);
  }
}
