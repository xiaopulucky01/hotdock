/**
 * Module contract: every business module must declare this.
 * Core discovers plugins via filesystem HotdockPlugin entries + Manifest,
 * never by statically importing business module internals in AppModule.
 */
export type ModuleStatus =
  | 'registered'
  | 'installed'
  | 'enabled'
  | 'disabled'
  | 'error';

export interface ModuleDependency {
  /** Dependent module name, e.g. "platform.user" or "ecommerce" */
  name: string;
  /** Semver range, e.g. "^1.0.0" */
  version?: string;
  optional?: boolean;
}

export interface ModulePermissionDef {
  code: string;
  name: string;
  description?: string;
}

export interface ModuleRouteDef {
  /** Absolute or relative prefix under /api, e.g. "ecommerce" → /api/ecommerce */
  prefix: string;
  version?: string;
}

export interface ModuleEventDef {
  /** Namespaced event, e.g. "ecommerce.order.created" */
  name: string;
  description?: string;
  /** Optional JSON-schema-like hint for payload */
  payloadHint?: Record<string, unknown>;
}

export interface ModuleHookDef {
  /** Extension slot this module provides or consumes */
  slot: string;
  description?: string;
}

export interface ModuleManifest {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  author?: string;
  dependencies?: ModuleDependency[];
  permissions?: ModulePermissionDef[];
  routes?: ModuleRouteDef[];
  events?: ModuleEventDef[];
  hooks?: ModuleHookDef[];
  /** Feature flags this module owns */
  features?: string[];
  /** Config keys this module reads (namespaced) */
  configKeys?: string[];
  /**
   * Declared host capabilities this plugin requires
   * (e.g. persistence.write, secrets.read, jobs.register).
   */
  capabilities?: string[];
  /** Semver range of Hotdock core API this plugin supports */
  coreApi?: string;
}

export interface RegisteredModule {
  manifest: ModuleManifest;
  status: ModuleStatus;
  registeredAt: Date | string;
  enabledAt?: Date | string;
  error?: string;
}

/** Config key schema registered by modules */
export interface ConfigKeySchema {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  secret?: boolean;
  description?: string;
  default?: unknown;
}
