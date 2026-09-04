import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StorageService } from './storage.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/storage')
@UseGuards(AuthGuard, PermissionsGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list(@Query('module') module?: string) {
    return this.storage.list(module);
  }
}
