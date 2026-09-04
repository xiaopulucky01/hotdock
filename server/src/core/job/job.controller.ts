import { Controller, Get, Query } from '@nestjs/common';
import { JobSchedulerService } from './job-scheduler.service';

@Controller('api/platform/jobs')
export class JobController {
  constructor(private readonly jobs: JobSchedulerService) {}

  @Get()
  list(@Query('module') module?: string) {
    return this.jobs.list(module);
  }
}
