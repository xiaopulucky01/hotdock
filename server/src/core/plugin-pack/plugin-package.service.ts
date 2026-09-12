import { Injectable, BadRequestException } from '@nestjs/common';
import * as semver from 'semver';
import { ModuleManifest } from '../contracts';

/** Stable Hotdock core API version — plugins declare compatibility range. */
export const HOTDOCK_CORE_API = '1.0.0';

export interface PluginPackageMeta {
  name: string;
  version: string;
  /** Semver range of core API this package supports */
  coreApi: string;
  main: string;
  capabilities?: string[];
  manifest: ModuleManifest;
}

const KNOWN_CAPABILITIES = new Set([
  'persistence.write',
  'persistence.read',
  'http.outbound',
  'secrets.read',
  'jobs.register',
  'events.emit',
  'extensions.contribute',
  'storage.write',
  'realtime.publish',
  'commands.register',
]);

/**
 * Validates external plugin package metadata (hotdock-plugin.json / manifest).
 */
@Injectable()
export class PluginPackageService {
  coreApi() {
    return HOTDOCK_CORE_API;
  }

  validate(meta: PluginPackageMeta): { ok: true } | { ok: false; errors: string[] } {
    const errors: string[] = [];
    if (!meta.name) errors.push('name required');
    if (!meta.version || !semver.valid(meta.version)) {
      errors.push('valid semver version required');
    }
    if (!meta.coreApi || !semver.validRange(meta.coreApi)) {
      errors.push('coreApi semver range required');
    } else if (!semver.satisfies(HOTDOCK_CORE_API, meta.coreApi)) {
      errors.push(
        `coreApi ${meta.coreApi} does not satisfy host ${HOTDOCK_CORE_API}`,
      );
    }
    if (!meta.main) errors.push('main entry required');
    if (!meta.manifest?.name) errors.push('manifest.name required');
    for (const cap of meta.capabilities ?? []) {
      if (!KNOWN_CAPABILITIES.has(cap)) {
        errors.push(`unknown capability: ${cap}`);
      }
    }
    if (errors.length) return { ok: false, errors };
    return { ok: true };
  }

  assertValid(meta: PluginPackageMeta) {
    const result = this.validate(meta);
    if (!result.ok) {
      throw new BadRequestException({
        message: 'Invalid plugin package',
        errors: result.errors,
      });
    }
  }

  knownCapabilities() {
    return [...KNOWN_CAPABILITIES];
  }
}
