import type { HotdockPlugin } from '../../core/contracts';
import { DEMO_MANIFEST } from './demo.manifest';
import { DemoModule } from './demo.module';
import { DemoPluginService } from './demo-plugin.service';

const plugin: HotdockPlugin = {
  manifest: DEMO_MANIFEST,
  module: DemoModule,
  lifecycle: DemoPluginService,
};

export default plugin;
