import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ModuleRegistryService } from './module-registry.service';
import {
  AuthGuard,
  PermissionsGuard,
  RequirePermissions,
} from '../gateway';

@Controller('api/platform/modules')
@UseGuards(AuthGuard, PermissionsGuard)
export class ModuleRegistryController {
  constructor(private readonly registry: ModuleRegistryService) {}

  @Get()
  @RequirePermissions('platform.module.manage')
  list() {
    return this.registry.getModules();
  }

  @Get(':name')
  @RequirePermissions('platform.module.manage')
  get(@Param('name') name: string) {
    return this.registry.getModule(name) ?? null;
  }

  @Post(':name/install')
  @RequirePermissions('platform.module.manage')
  install(@Param('name') name: string) {
    return this.registry.install(name);
  }

  @Post(':name/enable')
  @RequirePermissions('platform.module.manage')
  enable(@Param('name') name: string) {
    return this.registry.enable(name);
  }

  @Post(':name/disable')
  @RequirePermissions('platform.module.manage')
  disable(@Param('name') name: string) {
    return this.registry.disable(name);
  }

  @Post(':name/uninstall')
  @RequirePermissions('platform.module.manage')
  uninstall(@Param('name') name: string) {
    return this.registry.uninstall(name);
  }
}
