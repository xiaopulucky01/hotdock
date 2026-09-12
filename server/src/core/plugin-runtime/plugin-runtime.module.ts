import { Global, Module } from '@nestjs/common';
import { PluginDiscoveryService } from './plugin-discovery.service';
import { PluginRouteManager } from './plugin-route-manager';
import { PluginRuntimeService } from './plugin-runtime.service';

@Global()
@Module({
  providers: [
    PluginDiscoveryService,
    PluginRouteManager,
    PluginRuntimeService,
  ],
  exports: [PluginRuntimeService, PluginDiscoveryService],
})
export class PluginRuntimeModule {}
