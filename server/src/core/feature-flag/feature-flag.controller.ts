import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service';

@Controller('api/platform/features')
export class FeatureFlagController {
  constructor(private readonly flags: FeatureFlagService) {}

  @Get()
  list() {
    return this.flags.list();
  }

  @Get(':flag')
  get(@Param('flag') flag: string) {
    return { flag, enabled: this.flags.isEnabled(flag) };
  }

  @Put(':flag')
  set(@Param('flag') flag: string, @Body() body: { enabled: boolean }) {
    this.flags.set(flag, body.enabled);
    return { flag, enabled: body.enabled };
  }
}
