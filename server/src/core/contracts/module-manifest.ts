/**
 * Module contract: every business module must declare this.
 * Core discovers modules via Manifest, never by importing internals.
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
}

export interface RegisteredModule {
  manifest: ModuleManifest;
  status: ModuleStatus;
  registeredAt: Date;
  enabledAt?: Date;
  error?: string;
}
