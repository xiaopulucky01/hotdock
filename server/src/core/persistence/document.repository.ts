import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PersistenceService } from './persistence.service';
import {
  CollectionStore,
  DocumentPage,
  DocumentQuery,
  DocumentRecord,
} from './document.types';

/**
 * Tenant-scoped document repository over PersistenceAdapter.
 * Collection name is namespaced: docs.<module>.<collection>
 */
@Injectable()
export class DocumentRepository {
  constructor(private readonly persistence: PersistenceService) {}

  collectionKey(module: string, collection: string) {
    return `docs.${module}.${collection}`;
  }

  private async loadStore<T extends Record<string, unknown>>(
    key: string,
  ): Promise<CollectionStore<T>> {
    const data = await this.persistence.load<CollectionStore<T>>(key);
    return data ?? { docs: [] };
  }

  private async saveStore<T extends Record<string, unknown>>(
    key: string,
    store: CollectionStore<T>,
  ) {
    await this.persistence.save(key, store);
  }

  async insert<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    data: T,
    opts?: { tenantId?: string; id?: string },
  ): Promise<DocumentRecord<T>> {
    const key = this.collectionKey(module, collection);
    const store = await this.loadStore<T>(key);
    const now = new Date().toISOString();
    const doc: DocumentRecord<T> = {
      ...data,
      id: opts?.id ?? randomUUID(),
      tenantId: opts?.tenantId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    store.docs.push(doc);
    await this.saveStore(key, store);
    return doc;
  }

  async findById<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    id: string,
    tenantId?: string,
  ): Promise<DocumentRecord<T> | undefined> {
    const store = await this.loadStore<T>(this.collectionKey(module, collection));
    return store.docs.find(
      (d) => d.id === id && (tenantId === undefined || d.tenantId === tenantId),
    );
  }

  async require<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    id: string,
    tenantId?: string,
  ): Promise<DocumentRecord<T>> {
    const doc = await this.findById<T>(module, collection, id, tenantId);
    if (!doc) {
      throw new NotFoundException(`${module}/${collection}/${id} not found`);
    }
    return doc;
  }

  async query<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    q: DocumentQuery = {},
  ): Promise<DocumentPage<DocumentRecord<T>>> {
    const store = await this.loadStore<T>(this.collectionKey(module, collection));
    let items = store.docs.slice();
    if (q.tenantId !== undefined) {
      items = items.filter((d) => d.tenantId === q.tenantId);
    }
    if (q.where) {
      items = items.filter((d) =>
        Object.entries(q.where!).every(([k, v]) => (d as Record<string, unknown>)[k] === v),
      );
    }
    if (q.orderBy) {
      const dir = q.orderDir === 'desc' ? -1 : 1;
      const field = q.orderBy;
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[field];
        const bv = (b as Record<string, unknown>)[field];
        if (av === bv) return 0;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        return av < bv ? -1 * dir : 1 * dir;
      });
    }
    const total = items.length;
    const offset = q.offset ?? 0;
    const limit = q.limit ?? 50;
    return {
      items: items.slice(offset, offset + limit),
      total,
      limit,
      offset,
    };
  }

  async update<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    id: string,
    patch: Partial<T>,
    opts?: { tenantId?: string; expectedVersion?: number },
  ): Promise<DocumentRecord<T>> {
    const key = this.collectionKey(module, collection);
    const store = await this.loadStore<T>(key);
    const idx = store.docs.findIndex(
      (d) =>
        d.id === id &&
        (opts?.tenantId === undefined || d.tenantId === opts.tenantId),
    );
    if (idx < 0) {
      throw new NotFoundException(`${module}/${collection}/${id} not found`);
    }
    const current = store.docs[idx];
    if (
      typeof opts?.expectedVersion === 'number' &&
      current.version !== opts.expectedVersion
    ) {
      throw new ConflictException(
        `Version conflict for ${id}: expected ${opts.expectedVersion}, got ${current.version}`,
      );
    }
    const next: DocumentRecord<T> = {
      ...current,
      ...patch,
      id: current.id,
      tenantId: current.tenantId,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    store.docs[idx] = next;
    await this.saveStore(key, store);
    return next;
  }

  async delete(
    module: string,
    collection: string,
    id: string,
    tenantId?: string,
  ): Promise<boolean> {
    const key = this.collectionKey(module, collection);
    const store = await this.loadStore(key);
    const before = store.docs.length;
    store.docs = store.docs.filter(
      (d) =>
        !(d.id === id && (tenantId === undefined || d.tenantId === tenantId)),
    );
    if (store.docs.length === before) return false;
    await this.saveStore(key, store);
    return true;
  }

  async replaceAll<T extends Record<string, unknown>>(
    module: string,
    collection: string,
    docs: DocumentRecord<T>[],
  ) {
    await this.saveStore(this.collectionKey(module, collection), { docs });
  }
}
