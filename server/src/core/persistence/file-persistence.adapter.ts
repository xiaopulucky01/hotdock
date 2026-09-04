import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PersistenceAdapter } from './persistence.types';

/**
 * JSON-file persistence under DATA_DIR (default .data/).
 * One file per collection: `.data/<collection>.json`
 */
@Injectable()
export class FilePersistenceAdapter
  implements PersistenceAdapter, OnModuleDestroy
{
  private readonly logger = new Logger(FilePersistenceAdapter.name);
  private readonly root: string;
  private readonly pending = new Map<string, unknown>();
  private flushTimer?: NodeJS.Timeout;
  private readonly debounceMs = 200;

  constructor() {
    this.root = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(process.cwd(), '.data');
  }

  private fileOf(collection: string) {
    const safe = collection.replace(/[^a-zA-Z0-9._-]/g, '_');
    return path.join(this.root, `${safe}.json`);
  }

  async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async load<T = unknown>(collection: string): Promise<T | undefined> {
    await this.ensureRoot();
    if (this.pending.has(collection)) {
      return this.pending.get(collection) as T;
    }
    try {
      const raw = await fs.readFile(this.fileOf(collection), 'utf8');
      return JSON.parse(raw) as T;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      this.logger.warn(
        `Failed to load ${collection}: ${(err as Error).message}`,
      );
      return undefined;
    }
  }

  async save<T = unknown>(collection: string, data: T): Promise<void> {
    this.pending.set(collection, data);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, this.debounceMs);
  }

  async delete(collection: string): Promise<void> {
    this.pending.delete(collection);
    await this.ensureRoot();
    try {
      await fs.unlink(this.fileOf(collection));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async listCollections(): Promise<string[]> {
    await this.ensureRoot();
    const files = await fs.readdir(this.root);
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length));
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    await this.ensureRoot();
    const entries = [...this.pending.entries()];
    this.pending.clear();
    await Promise.all(
      entries.map(async ([collection, data]) => {
        const tmp = `${this.fileOf(collection)}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(tmp, this.fileOf(collection));
      }),
    );
  }

  async onModuleDestroy() {
    await this.flush();
  }
}
