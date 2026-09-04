import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ModuleRegistryService } from './module-registry.service';

@Controller('api/platform/modules')
export class ModuleRegistryController {
  constructor(private readonly registry: ModuleRegistryService) {}

  @Get()
  list() {
    return this.registry.getModules();
  }

  @Get(':name')
  get(@Param('name') name: string) {
    return this.registry.getModule(name) ?? null;
  }

  @Post(':name/install')
  install(@Param('name') name: string) {
    return this.registry.install(name);
  }

  @Post(':name/enable')
  enable(@Param('name') name: string) {
    return this.registry.enable(name);
  }

  @Post(':name/disable')
  disable(@Param('name') name: string) {
    return this.registry.disable(name);
  }

  @Post(':name/uninstall')
  uninstall(@Param('name') name: string) {
    return this.registry.uninstall(name);
  }
}
