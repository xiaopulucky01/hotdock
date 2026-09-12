import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
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

  @Public()
  @Get('metrics/prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  prometheus(@Res() res: Response) {
    res.send(this.obs.prometheus());
  }

  @Get('traces')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('platform.audit.read')
  traces() {
    return this.obs.recentTraces();
  }
}
