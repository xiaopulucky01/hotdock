import { ModuleManifest } from '../../core/contracts';

export const DEMO_MANIFEST: ModuleManifest = {
  name: 'demo',
  version: '1.0.0',
  displayName: 'Demo Module',
  description: 'Sample hot-pluggable business module for the platform base',
  author: 'platform',
  dependencies: [],
  permissions: [
    { code: 'demo.read', name: '查看 Demo' },
    { code: 'demo.write', name: '写入 Demo' },
  ],
  routes: [{ prefix: 'demo', version: '1' }],
  events: [
    {
      name: 'demo.ping',
      description: 'Demo heartbeat event',
      payloadHint: { message: 'string' },
    },
  ],
  hooks: [{ slot: 'platform.nav.items', description: 'Contribute nav item' }],
  features: ['demo.enabled'],
  configKeys: ['demo.greeting'],
};
