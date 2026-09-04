import { Injectable, NotFoundException } from '@nestjs/common';

export interface StoredObject {
  key: string;
  module: string;
  contentType: string;
  size: number;
  /** In-memory body — swap to S3/OSS adapter later */
  data: Buffer;
  createdAt: Date;
  metadata?: Record<string, string>;
}

@Injectable()
export class StorageService {
  private readonly objects = new Map<string, StoredObject>();

  put(input: {
    module: string;
    key: string;
    data: Buffer | string;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Omit<StoredObject, 'data'> {
    const namespaced = `${input.module}/${input.key}`;
    const buf = Buffer.isBuffer(input.data)
      ? input.data
      : Buffer.from(input.data);
    const obj: StoredObject = {
      key: namespaced,
      module: input.module,
      contentType: input.contentType ?? 'application/octet-stream',
      size: buf.length,
      data: buf,
      createdAt: new Date(),
      metadata: input.metadata,
    };
    this.objects.set(namespaced, obj);
    const { data: _d, ...meta } = obj;
    return meta;
  }

  get(module: string, key: string): StoredObject {
    const namespaced = `${module}/${key}`;
    const obj = this.objects.get(namespaced);
    if (!obj) {
      throw new NotFoundException(`Object ${namespaced} not found`);
    }
    return obj;
  }

  delete(module: string, key: string) {
    this.objects.delete(`${module}/${key}`);
  }

  list(module?: string) {
    return [...this.objects.values()]
      .filter((o) => !module || o.module === module)
      .map(({ data: _d, ...meta }) => meta);
  }
}
