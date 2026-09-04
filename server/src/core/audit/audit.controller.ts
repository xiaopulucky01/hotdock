import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import {
  AuthGuard,
  CurrentTenant,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/audit')
@UseGuards(AuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('platform.audit.read')
  list(
    @Query('module') module?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
    @CurrentTenant() tenantId?: string,
  ) {
    return this.audit.list({
      module,
      actorId,
      tenantId,
      limit: limit ? Number(limit) : 100,
    });
  }
}
