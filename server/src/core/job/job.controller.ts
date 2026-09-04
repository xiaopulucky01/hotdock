import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { JobSchedulerService } from './job-scheduler.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class UpdateJobDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(100)
  intervalMs?: number;

  /** Pass null to clear cron and use intervalMs */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  cron?: string | null;
}

@Controller('api/platform/jobs')
@UseGuards(AuthGuard, PermissionsGuard)
export class JobController {
  constructor(private readonly jobs: JobSchedulerService) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  list(@Query('module') module?: string) {
    return this.jobs.list(module);
  }

  @Patch(':module/:name')
  @RequirePermissions('platform.config.manage')
  update(
    @Param('module') module: string,
    @Param('name') name: string,
    @Body() body: UpdateJobDto,
  ) {
    return this.jobs.update(module, name, body);
  }

  @Post(':module/:name/run')
  @RequirePermissions('platform.config.manage')
  run(@Param('module') module: string, @Param('name') name: string) {
    return this.jobs.trigger(module, name);
  }
}
