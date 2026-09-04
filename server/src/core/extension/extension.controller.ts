import { Controller, Get, Param } from '@nestjs/common';
import { ExtensionService } from './extension.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

@Controller('api/platform/extensions')
export class ExtensionController {
  constructor(
    private readonly extensions: ExtensionService,
    private readonly features: FeatureFlagService,
  ) {}

  @Get()
  slots() {
    return this.extensions.listSlots();
  }

  @Get(':slot')
  list(@Param('slot') slot: string) {
    return this.extensions.list(slot, this.features);
  }
}
