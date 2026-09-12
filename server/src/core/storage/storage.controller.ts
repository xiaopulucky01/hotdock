import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { StorageService } from './storage.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';
import { QuotaService } from '../tenant/quota.service';

class PutObjectDto {
  @IsString() module!: string;
  @IsString() key!: string;
  /** base64 or utf8 text */
  @IsString() data!: string;
  @IsOptional() @IsString() encoding?: 'base64' | 'utf8';
  @IsOptional() @IsString() contentType?: string;
}

@Controller('api/platform/storage')
@UseGuards(AuthGuard, PermissionsGuard)
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly quotas: QuotaService,
  ) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list(@Query('module') module?: string) {
    return this.storage.list(module);
  }

  @Get('object')
  @RequirePermissions('platform.config.manage')
  async get(@Query('module') module: string, @Query('key') key: string) {
    const obj = await this.storage.get(module, key);
    return {
      key: obj.key,
      module: obj.module,
      contentType: obj.contentType,
      size: obj.size,
      createdAt: obj.createdAt,
      metadata: obj.metadata,
      data: obj.data.toString('base64'),
      encoding: 'base64' as const,
    };
  }

  @Post()
  @RequirePermissions('platform.config.manage')
  async put(@Body() body: PutObjectDto) {
    const buf =
      body.encoding === 'base64'
        ? Buffer.from(body.data, 'base64')
        : Buffer.from(body.data, 'utf8');
    this.quotas.assertWithin('tenant_default', 'storageBytes', buf.length);
    const meta = await this.storage.put({
      module: body.module,
      key: body.key,
      data: buf,
      contentType: body.contentType,
    });
    this.quotas.recordUsage('tenant_default', { storageBytes: buf.length });
    return meta;
  }

  @Delete()
  @RequirePermissions('platform.config.manage')
  async remove(@Query('module') module: string, @Query('key') key: string) {
    await this.storage.delete(module, key);
    return { ok: true };
  }
}
