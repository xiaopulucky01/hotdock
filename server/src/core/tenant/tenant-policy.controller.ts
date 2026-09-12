import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { QuotaService } from './quota.service';
import { TenantModulesService } from './tenant-modules.service';
import { TenantConfigService } from './tenant-config.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class QuotaDto {
  @IsOptional() @IsNumber() apiRpm?: number;
  @IsOptional() @IsNumber() storageBytes?: number;
  @IsOptional() @IsNumber() jobs?: number;
  @IsOptional() @IsNumber() llmTokensPerDay?: number;
}

class ModulesGrantDto {
  @IsOptional() @IsArray() @IsString({ each: true }) allow?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) deny?: string[];
  @IsOptional() @IsBoolean() denyAll?: boolean;
}

class TenantConfigDto {
  @IsString() key!: string;
  @IsOptional() value?: unknown;
}

@Controller('api/platform/tenants')
@UseGuards(AuthGuard, PermissionsGuard)
export class TenantPolicyController {
  constructor(
    private readonly quotas: QuotaService,
    private readonly modules: TenantModulesService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  @Get(':id/quotas')
  @RequirePermissions('platform.tenant.read')
  getQuota(@Param('id') id: string) {
    return this.quotas.get(id);
  }

  @Put(':id/quotas')
  @RequirePermissions('platform.tenant.create')
  setQuota(@Param('id') id: string, @Body() body: QuotaDto) {
    return this.quotas.set(id, body);
  }

  @Get(':id/modules')
  @RequirePermissions('platform.tenant.read')
  getModules(@Param('id') id: string) {
    return this.modules.get(id);
  }

  @Put(':id/modules')
  @RequirePermissions('platform.tenant.create')
  setModules(@Param('id') id: string, @Body() body: ModulesGrantDto) {
    return this.modules.set(id, body);
  }

  @Get(':id/config')
  @RequirePermissions('platform.config.read')
  listConfig(@Param('id') id: string) {
    return this.tenantConfig.resolved(id);
  }

  @Put(':id/config')
  @RequirePermissions('platform.config.write')
  setConfig(@Param('id') id: string, @Body() body: TenantConfigDto) {
    this.tenantConfig.set(id, body.key, body.value);
    return { ok: true };
  }

  @Delete(':id/config/:key')
  @RequirePermissions('platform.config.write')
  deleteConfig(@Param('id') id: string, @Param('key') key: string) {
    this.tenantConfig.delete(id, key);
    return { ok: true };
  }
}
