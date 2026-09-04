import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  AuthGuard,
  ModuleEnabledGuard,
  PermissionsGuard,
  Public,
  RequireModule,
  RequirePermissions,
} from '../../core/gateway';
import { DemoPluginService } from './demo-plugin.service';
import { DEMO_MANIFEST } from './demo.manifest';

@Controller('api/demo')
@RequireModule(DEMO_MANIFEST.name)
@UseGuards(ModuleEnabledGuard)
export class DemoController {
  constructor(private readonly demo: DemoPluginService) {}

  @Public()
  @Get('hello')
  hello() {
    return { enabled: true, message: this.demo.greeting() };
  }

  @Get('secure')
  @UseGuards(AuthGuard, PermissionsGuard)
  @RequirePermissions('demo.read')
  secure() {
    return { ok: true, message: 'You have demo.read' };
  }
}
