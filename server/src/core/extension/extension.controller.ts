import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ExtensionService } from './extension.service';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/extensions')
@UseGuards(AuthGuard, PermissionsGuard)
export class ExtensionController {
  constructor(
    private readonly extensions: ExtensionService,
    private readonly features: FeatureFlagService,
  ) {}

  @Get()
  @RequirePermissions('platform.config.manage')
  slots() {
    return this.extensions.listSlots();
  }

  @Get(':slot')
  @RequirePermissions('platform.config.manage')
  list(@Param('slot') slot: string) {
    return this.extensions.list(slot, this.features);
  }
}
