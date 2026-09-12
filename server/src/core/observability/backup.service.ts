import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PersistenceService } from '../persistence/persistence.service';

export interface BackupManifest {
  id: string;
  createdAt: string;
  collections: string[];
  path: string;
}

/**
 * Export/import all persistence collections for disaster recovery
 * and tenant data portability (full dump; filter by tenant at restore time if needed).
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupRoot: string;

  constructor(private readonly persistence: PersistenceService) {
    const dataDir = process.env.DATA_DIR
      ? path.resolve(process.env.DATA_DIR)
      : path.resolve(process.cwd(), '.data');
    this.backupRoot = path.join(dataDir, 'backups');
  }

  async create(): Promise<BackupManifest> {
    await this.persistence.flush();
    await fs.mkdir(this.backupRoot, { recursive: true });
    const id = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const dir = path.join(this.backupRoot, id);
    await fs.mkdir(dir, { recursive: true });

    const collections = await this.persistence.listCollections();
    const dump: Record<string, unknown> = {};
    for (const col of collections) {
      if (col.startsWith('backup')) continue;
      dump[col] = await this.persistence.load(col);
    }
    const file = path.join(dir, 'dump.json');
    await fs.writeFile(file, JSON.stringify(dump, null, 2), 'utf8');

    const manifest: BackupManifest = {
      id,
      createdAt: new Date().toISOString(),
      collections: Object.keys(dump),
      path: file,
    };
    await fs.writeFile(
      path.join(dir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8',
    );
    this.logger.log(`Backup created: ${id}`);
    return manifest;
  }

  async list(): Promise<BackupManifest[]> {
    try {
      await fs.mkdir(this.backupRoot, { recursive: true });
      const dirs = await fs.readdir(this.backupRoot);
      const out: BackupManifest[] = [];
      for (const d of dirs) {
        try {
          const raw = await fs.readFile(
            path.join(this.backupRoot, d, 'manifest.json'),
            'utf8',
          );
          out.push(JSON.parse(raw) as BackupManifest);
        } catch {
          /* skip */
        }
      }
      return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } catch {
      return [];
    }
  }

  async restore(id: string) {
    const file = path.join(this.backupRoot, id, 'dump.json');
    const raw = await fs.readFile(file, 'utf8');
    const dump = JSON.parse(raw) as Record<string, unknown>;
    for (const [col, data] of Object.entries(dump)) {
      await this.persistence.save(col, data);
    }
    await this.persistence.flush();
    this.logger.warn(`Restored backup ${id} — restart recommended`);
    return { ok: true, collections: Object.keys(dump) };
  }
}
