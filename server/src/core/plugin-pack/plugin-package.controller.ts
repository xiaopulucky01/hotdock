import { Controller, Get, UseGuards } from '@nestjs/common';
import { PluginPackageService } from './plugin-package.service';
import {
  AuthGuard,
  PermissionsGuard,
  Public,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/plugin-pack')
export class PluginPackageController {
  constructor(private readonly packs: PluginPackageService) {}

  @Public()
  @Get('core-api')
  coreApi() {
    return {
      coreApi: this.packs.coreApi(),
      capabilities: this.packs.knownCapabilities(),
    };
  }

  @Get('capabilities')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('platform.module.read')
  capabilities() {
    return this.packs.knownCapabilities();
  }
}
