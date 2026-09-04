import { Controller, Get } from '@nestjs/common';
import { ObservabilityService } from './observability.service';

@Controller('api/platform')
export class ObservabilityController {
  constructor(private readonly obs: ObservabilityService) {}

  @Get('health')
  health() {
    return this.obs.health();
  }

  @Get('metrics')
  metrics() {
    return this.obs.getMetrics();
  }
}
