import { Controller, Get, UseGuards } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import {
  AuthGuard,
  PermissionsGuard,
  Public,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform')
export class ObservabilityController {
  constructor(private readonly obs: ObservabilityService) {}

  @Public()
  @Get('health')
  health() {
    return this.obs.health();
  }

  @Get('metrics')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('platform.audit.read')
  metrics() {
    return this.obs.getMetrics();
  }
}
