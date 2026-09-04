import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { PlatformConfigService } from './config.service';

@Controller('api/platform/config')
export class ConfigController {
  constructor(private readonly config: PlatformConfigService) {}

  @Get()
  list(@Query('prefix') prefix?: string) {
    return this.config.list(prefix);
  }

  @Get(':key')
  get(@Param('key') key: string) {
    return { key, value: this.config.get(key) };
  }

  @Put(':key')
  set(@Param('key') key: string, @Body() body: { value: unknown }) {
    this.config.set(key, body.value);
    return { key, value: body.value };
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    this.config.delete(key);
    return { ok: true };
  }
}
