import { Global, Module } from '@nestjs/common';
import { PluginPackageService } from './plugin-package.service';
import { PluginPackageController } from './plugin-package.controller';

@Global()
@Module({
  providers: [PluginPackageService],
  controllers: [PluginPackageController],
  exports: [PluginPackageService],
})
export class PluginPackModule {}
