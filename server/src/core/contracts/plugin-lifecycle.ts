export interface PluginLifecycle {
  onInstall?(): void | Promise<void>;
  onEnable?(): void | Promise<void>;
  onDisable?(): void | Promise<void>;
  onUninstall?(): void | Promise<void>;
}

/** Token for Nest DI when a business module exposes lifecycle hooks */
export const PLUGIN_LIFECYCLE = Symbol('PLUGIN_LIFECYCLE');
