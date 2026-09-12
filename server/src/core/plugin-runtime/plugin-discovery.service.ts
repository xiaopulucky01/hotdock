import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { createRequire } from 'module';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { HotdockPlugin } from '../contracts';

export interface DiscoveredPlugin {
  /** Absolute path to plugin entry file */
  entryPath: string;
  /** Directory containing the plugin */
  rootDir: string;
  plugin: HotdockPlugin;
}

@Injectable()
export class PluginDiscoveryService {
  private readonly logger = new Logger(PluginDiscoveryService.name);
  private readonly require = createRequire(__filename);

  /** Built-in modules compiled next to core (`dist/modules/{name}/plugin.js`). */
  builtinDir(): string {
    return path.join(__dirname, '..', '..', 'modules');
  }

  /** External drop-in plugins (optional). */
  externalDir(): string {
    return (
      process.env.HOTDOCK_PLUGINS_DIR ?? path.join(process.cwd(), 'plugins')
    );
  }

  async discoverAll(): Promise<DiscoveredPlugin[]> {
    const dirs = [this.builtinDir(), this.externalDir()];
    const found: DiscoveredPlugin[] = [];
    const seen = new Set<string>();

    for (const dir of dirs) {
      const entries = await this.scanDir(dir);
      for (const entryPath of entries) {
        try {
          const plugin = await this.loadEntry(entryPath);
          if (seen.has(plugin.manifest.name)) {
            this.logger.warn(
              `Duplicate plugin "${plugin.manifest.name}" at ${entryPath}, skipping`,
            );
            continue;
          }
          seen.add(plugin.manifest.name);
          found.push({
            entryPath,
            rootDir: path.dirname(entryPath),
            plugin,
          });
        } catch (err) {
          this.logger.error(
            `Failed to load plugin entry ${entryPath}: ${(err as Error).message}`,
          );
        }
      }
    }

    this.logger.log(`Discovered ${found.length} plugin(s)`);
    return found;
  }

  async discoverOne(name: string): Promise<DiscoveredPlugin | undefined> {
    const all = await this.discoverAll();
    return all.find((p) => p.plugin.manifest.name === name);
  }

  async loadEntry(entryPath: string): Promise<HotdockPlugin> {
    // Prefer require for Nest CJS output so default export unwraps correctly
    // and require.cache can be cleared on unload.
    let raw: unknown;
    if (entryPath.endsWith('.mjs')) {
      const href = `${pathToFileURL(entryPath).href}?t=${Date.now()}`;
      const mod = await import(href);
      raw = mod;
    } else {
      delete this.require.cache[entryPath];
      raw = this.require(entryPath);
    }

    const plugin = this.unwrapPlugin(raw);
    if (!plugin?.manifest?.name || !plugin.module || !plugin.lifecycle) {
      throw new Error(
        `Invalid HotdockPlugin at ${entryPath}: need manifest, module, lifecycle`,
      );
    }
    return plugin;
  }

  private unwrapPlugin(mod: unknown): HotdockPlugin {
    let cur = mod as Record<string, unknown> | HotdockPlugin;
    // Node/CJS interop: module.exports.default or nested .default
    for (let i = 0; i < 3; i++) {
      if (
        cur &&
        typeof cur === 'object' &&
        'manifest' in cur &&
        'module' in cur &&
        'lifecycle' in cur
      ) {
        return cur as HotdockPlugin;
      }
      if (cur && typeof cur === 'object' && 'default' in cur) {
        cur = (cur as { default: typeof cur }).default;
        continue;
      }
      if (cur && typeof cur === 'object' && 'plugin' in cur) {
        cur = (cur as { plugin: typeof cur }).plugin;
        continue;
      }
      break;
    }
    return cur as HotdockPlugin;
  }

  private async scanDir(dir: string): Promise<string[]> {
    try {
      await fs.access(dir);
    } catch {
      return [];
    }

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      for (const candidate of ['plugin.js', 'plugin.mjs', 'index.js']) {
        const full = path.join(dir, entry.name, candidate);
        try {
          await fs.access(full);
          paths.push(full);
          break;
        } catch {
          // try next candidate
        }
      }
    }
    return paths;
  }
}
