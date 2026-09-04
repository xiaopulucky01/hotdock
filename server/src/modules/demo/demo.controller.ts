import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, RequirePermissions, PermissionsGuard } from '../../core/gateway';
import { ModuleRegistryService } from '../../core/module-registry/module-registry.service';
import { DemoPluginService } from './demo-plugin.service';
import { DEMO_MANIFEST } from './demo.manifest';

@Controller('api/demo')
export class DemoController {
  constructor(
    private readonly demo: DemoPluginService,
    private readonly registry: ModuleRegistryService,
  ) {}

  @Get('hello')
  hello() {
    if (!this.registry.isEnabled(DEMO_MANIFEST.name)) {
      return { enabled: false, message: 'Demo module is disabled' };
    }
    return { enabled: true, message: this.demo.greeting() };
  }

  @Get('secure')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('demo.read')
  secure() {
    return { ok: true, message: 'You have demo.read' };
  }
}
