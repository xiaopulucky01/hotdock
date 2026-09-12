import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiKeyService } from './api-key.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleIds?: string[];

  @IsOptional()
  @IsString()
  subject?: string;
}

@Controller('api/platform/api-keys')
@UseGuards(AuthGuard, PermissionsGuard)
export class ApiKeyController {
  constructor(private readonly apiKeys: ApiKeyService) {}

  @Get()
  @RequirePermissions('platform.user.read')
  list() {
    return this.apiKeys.list();
  }

  @Post()
  @RequirePermissions('platform.user.write')
  create(@Body() body: CreateApiKeyDto) {
    return this.apiKeys.create(body);
  }

  @Delete(':id')
  @RequirePermissions('platform.user.write')
  revoke(@Param('id') id: string) {
    return this.apiKeys.revoke(id);
  }
}
