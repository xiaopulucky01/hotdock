import { Global, Module } from '@nestjs/common';
import { JobController } from './job.controller';
import { JobSchedulerService } from './job-scheduler.service';

@Global()
@Module({
  controllers: [JobController],
  providers: [JobSchedulerService],
  exports: [JobSchedulerService],
})
export class JobModule {}
