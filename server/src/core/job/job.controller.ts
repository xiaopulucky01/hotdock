import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/jobs')
@UseGuards(AuthGuard, PermissionsGuard)
export class JobController {
  constructor(private readonly jobs: JobSchedulerService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list(@Query('module') module?: string) {
    return this.jobs.list(module);
  }
}
