import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { BackupService } from './backup.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/backups')
@UseGuards(AuthGuard, PermissionsGuard)
export class BackupController {
  constructor(private readonly backups: BackupService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list() {
    return this.backups.list();
  }

  @Post()
  @RequirePermissions('platform.config.manage')
  create() {
    return this.backups.create();
  }

  @Post(':id/restore')
  @RequirePermissions('platform.config.manage')
  restore(@Param('id') id: string) {
    return this.backups.restore(id);
  }
}
