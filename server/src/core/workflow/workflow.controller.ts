import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { WorkflowService } from './workflow.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

class StartWorkflowDto {
  @IsString() module!: string;
  @IsString() name!: string;
  @IsOptional() @IsObject() context?: Record<string, unknown>;
}

@Controller('api/platform/workflows')
@UseGuards(AuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly workflows: WorkflowService) {}

  @Get()
  @RequirePermissions('platform.config.read')
  list() {
    return {
      defs: this.workflows.listDefs(),
      instances: this.workflows.listInstances(),
    };
  }

  @Post('start')
  @RequirePermissions('platform.config.write')
  start(@Body() body: StartWorkflowDto) {
    return this.workflows.start(body.module, body.name, body.context);
  }
}
