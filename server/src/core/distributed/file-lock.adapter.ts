import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LockAdapter } from './lock.types';

/**
 * Cross-process lock via atomic file create under DATA_DIR/locks.
 * Suitable for single-host multi-process; use RedisLockAdapter for clusters.
 */
@Injectable()
export class FileLockAdapter implements LockAdapter {
  private readonly logger = new Logger(FileLockAdapter.name);
  private readonly root: string;

  constructor() {
    const dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(process.cwd(), '.data');
    this.root = path.join(dataDir, 'locks');
  }

  private fileOf(key: string) {
    // Strip Windows-illegal path chars (notably `:`) — keys like job:demo:heartbeat
    // must become job_demo_heartbeat.lock
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.root, `${safe}.lock`);
  }

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async acquire(key: string, ttlMs: number, token: string): Promise<boolean> {
    await this.ensureRoot();
    const file = this.fileOf(key);
    const payload = JSON.stringify({
      token,
      expiresAt: Date.now() + ttlMs,
    });
    try {
      const fh = await fs.open(file, 'wx');
      await fh.writeFile(payload, 'utf8');
      await fh.close();
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        this.logger.warn(`Lock acquire failed: ${(err as Error).message}`);
        return false;
      }
      try {
        const raw = await fs.readFile(file, 'utf8');
        const cur = JSON.parse(raw) as { token: string; expiresAt: number };
        if (cur.expiresAt < Date.now() || cur.token === token) {
          await fs.writeFile(file, payload, 'utf8');
          return true;
        }
      } catch {
        // corrupt lock — try replace
        try {
          await fs.writeFile(file, payload, 'utf8');
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  async release(key: string, token: string): Promise<boolean> {
    const file = this.fileOf(key);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const cur = JSON.parse(raw) as { token: string };
      if (cur.token !== token) return false;
      await fs.unlink(file);
      return true;
    } catch {
      return false;
    }
  }

  async extend(key: string, token: string, ttlMs: number): Promise<boolean> {
    const file = this.fileOf(key);
    try {
      const raw = await fs.readFile(file, 'utf8');
      const cur = JSON.parse(raw) as { token: string; expiresAt: number };
      if (cur.token !== token) return false;
      await fs.writeFile(
        file,
        JSON.stringify({ token, expiresAt: Date.now() + ttlMs }),
        'utf8',
      );
      return true;
    } catch {
      return false;
    }
  }
}
