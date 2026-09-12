#!/usr/bin/env node
/**
 * Minimal Hotdock CLI: doctor | core-api | scaffold
 * Usage: node dist/bin/hotdock.js <command>
 */
const fs = require('fs');
const path = require('path');

const cmd = process.argv[2] ?? 'help';

function help() {
  console.log(`Hotdock CLI
  doctor      Check local data dir / env
  core-api    Print core API version
  scaffold <name>  Create modules/<name> skeleton under cwd
`);
}

function doctor() {
  const dataDir = process.env.DATA_DIR || path.resolve(process.cwd(), '.data');
  const checks = [
    ['DATA_DIR', dataDir, fs.existsSync(dataDir)],
    ['JWT_SECRET', process.env.JWT_SECRET ? 'set' : 'default', !!process.env.JWT_SECRET],
    ['SECRETS_MASTER_KEY', process.env.SECRETS_MASTER_KEY ? 'set' : 'derived', !!process.env.SECRETS_MASTER_KEY],
    ['REDIS_URL', process.env.REDIS_URL || '(memory/file)', !!process.env.REDIS_URL],
  ];
  for (const [k, v, ok] of checks) {
    console.log(`${ok ? 'OK' : '..'}  ${k}=${v}`);
  }
}

function coreApi() {
  console.log(JSON.stringify({ coreApi: '1.0.0', sdk: '1.0.0' }, null, 2));
}

function scaffold(name) {
  if (!name) {
    console.error('scaffold requires a name');
    process.exit(1);
  }
  const root = path.resolve(process.cwd(), 'src', 'modules', name);
  fs.mkdirSync(root, { recursive: true });
  const plugin = `import { Module } from '@nestjs/common';
import { createPlugin } from '../../../sdk';
import { ${pascal(name)}Lifecycle } from './${name}.lifecycle';

@Module({ providers: [${pascal(name)}Lifecycle] })
export class ${pascal(name)}Module {}

export default createPlugin({
  manifest: {
    name: '${name}',
    version: '0.1.0',
    displayName: '${pascal(name)}',
    coreApi: '^1.0.0',
    capabilities: ['events.emit', 'extensions.contribute'],
  },
  module: ${pascal(name)}Module,
  lifecycle: ${pascal(name)}Lifecycle,
});
`;
  const lifecycle = `import { Injectable } from '@nestjs/common';
import type { PluginLifecycle } from '../../../sdk';

@Injectable()
export class ${pascal(name)}Lifecycle implements PluginLifecycle {
  async onInstall() {}
  async onEnable() {}
  async onDisable() {}
  async onUninstall() {}
}
`;
  fs.writeFileSync(path.join(root, 'plugin.ts'), plugin);
  fs.writeFileSync(path.join(root, `${name}.lifecycle.ts`), lifecycle);
  console.log(`Scaffolded ${root}`);
}

function pascal(s) {
  return s
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

if (cmd === 'doctor') doctor();
else if (cmd === 'core-api') coreApi();
else if (cmd === 'scaffold') scaffold(process.argv[3]);
else help();
