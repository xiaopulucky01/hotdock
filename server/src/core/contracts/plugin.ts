import type { Type } from '@nestjs/common';
import type { ModuleManifest } from './module-manifest';
import type { PluginLifecycle } from './plugin-lifecycle';

/**
 * Hot-pluggable plugin entry contract.
 * Each business module exports this as default from `plugin.ts`.
 * Core discovers entries via filesystem — never by static AppModule imports.
 */
export interface HotdockPlugin {
  manifest: ModuleManifest;
  /** NestJS feature module (controllers + providers) */
  module: Type<unknown>;
  /** Provider token that implements PluginLifecycle */
  lifecycle: Type<PluginLifecycle>;
}
