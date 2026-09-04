import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformConfigService } from './config.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/config')
@UseGuards(AuthGuard, PermissionsGuard)
export class ConfigController {
  constructor(private readonly config: PlatformConfigService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list(@Query('prefix') prefix?: string) {
    return this.config.list(prefix);
  }

  @Get('schemas')
  @RequirePermissions('platform.config.manage')
  schemas() {
    return this.config.listSchemas();
  }

  @Get(':key')
  @RequirePermissions('platform.config.manage')
  get(@Param('key') key: string) {
    return { key, value: this.config.get(key) };
  }

  @Put(':key')
  @RequirePermissions('platform.config.manage')
  set(@Param('key') key: string, @Body() body: { value: unknown }) {
    this.config.set(key, body.value);
    return { key, value: body.value };
  }

  @Delete(':key')
  @RequirePermissions('platform.config.manage')
  remove(@Param('key') key: string) {
    this.config.delete(key);
    return { ok: true };
  }
}
