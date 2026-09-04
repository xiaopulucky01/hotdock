import { Module } from '@nestjs/common';
import { DemoController } from './demo.controller';
import { DemoPluginService } from './demo-plugin.service';

@Module({
  controllers: [DemoController],
  providers: [DemoPluginService],
  exports: [DemoPluginService],
})
export class DemoModule {}
