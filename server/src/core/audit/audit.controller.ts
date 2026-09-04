import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('api/platform/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('module') module?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({
      module,
      actorId,
      limit: limit ? Number(limit) : 100,
    });
  }
}
