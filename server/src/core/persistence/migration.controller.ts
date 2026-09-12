import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MigrationService } from './migration.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/migrations')
@UseGuards(AuthGuard, PermissionsGuard)
export class MigrationController {
  constructor(private readonly migrations: MigrationService) {}

  @Get()
  @RequirePermissions('platform.config.read')
  list() {
    return {
      applied: this.migrations.listApplied(),
      pending: this.migrations.listPending(),
    };
  }

  @Post('up')
  @RequirePermissions('platform.config.write')
  up(@Query('module') module?: string) {
    return this.migrations.up(module);
  }

  @Post(':id/down')
  @RequirePermissions('platform.config.write')
  down(@Param('id') id: string) {
    return this.migrations.down(id);
  }
}
