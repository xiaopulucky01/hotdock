import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PersistenceService } from '../persistence/persistence.service';

export interface StoredObjectMeta {
  key: string;
  module: string;
  contentType: string;
  size: number;
  createdAt: string;
  metadata?: Record<string, string>;
  /** Relative path under blob root when using disk adapter */
  blobPath?: string;
}

export interface StoredObject extends StoredObjectMeta {
  data: Buffer;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly objects = new Map<string, StoredObjectMeta>();
  private readonly blobRoot: string;
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {
    this.blobRoot = process.env.BLOB_DIR
      ? path.resolve(process.env.BLOB_DIR)
      : path.resolve(process.cwd(), '.data', 'blobs');
  }

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    await fs.mkdir(this.blobRoot, { recursive: true });
    const rows =
      await this.persistence.load<StoredObjectMeta[]>('storage-index');
    for (const row of rows ?? []) {
      this.objects.set(row.key, row);
    }
    this.loaded = true;
  }

  private async persistIndex() {
    await this.persistence.save('storage-index', [...this.objects.values()]);
  }

  private blobFile(namespaced: string) {
    const safe = namespaced.replace(/[^a-zA-Z0-9._/-]/g, '_');
    return path.join(this.blobRoot, safe);
  }

  async put(input: {
    module: string;
    key: string;
    data: Buffer | string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<StoredObjectMeta> {
    await this.ensureLoaded();
    const namespaced = `${input.module}/${input.key}`;
    const buf = Buffer.isBuffer(input.data)
      ? input.data
      : Buffer.from(input.data);
    const file = this.blobFile(namespaced);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);

    const meta: StoredObjectMeta = {
      key: namespaced,
      module: input.module,
      contentType: input.contentType ?? 'application/octet-stream',
      size: buf.length,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
      blobPath: path.relative(this.blobRoot, file),
    };
    this.objects.set(namespaced, meta);
    await this.persistIndex();
    return meta;
  }

  async get(module: string, key: string): Promise<StoredObject> {
    await this.ensureLoaded();
    const namespaced = `${module}/${key}`;
    const meta = this.objects.get(namespaced);
    if (!meta) {
      throw new NotFoundException(`Object ${namespaced} not found`);
    }
    const data = await fs.readFile(this.blobFile(namespaced));
    return { ...meta, data };
  }

  async delete(module: string, key: string) {
    await this.ensureLoaded();
    const namespaced = `${module}/${key}`;
    this.objects.delete(namespaced);
    try {
      await fs.unlink(this.blobFile(namespaced));
    } catch {
      // ignore missing blob
    }
    await this.persistIndex();
  }

  list(module?: string) {
    return [...this.objects.values()].filter(
      (o) => !module || o.module === module,
    );
  }
}
