import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  PERSISTENCE_ADAPTER,
  type PersistenceAdapter,
} from './persistence.types';

@Injectable()
export class PersistenceService implements OnModuleInit {
  private ready = false;

  constructor(
    @Inject(PERSISTENCE_ADAPTER)
    private readonly adapter: PersistenceAdapter,
  ) {}

  async onModuleInit() {
    this.ready = true;
  }

  isReady() {
    return this.ready;
  }

  load<T = unknown>(collection: string) {
    return this.adapter.load<T>(collection);
  }

  save<T = unknown>(collection: string, data: T) {
    return this.adapter.save(collection, data);
  }

  delete(collection: string) {
    return this.adapter.delete(collection);
  }

  listCollections() {
    return this.adapter.listCollections();
  }

  /** Force flush when adapter supports it (file adapter). */
  async flush() {
    const flushable = this.adapter as PersistenceAdapter & {
      flush?: () => Promise<void>;
    };
    if (flushable.flush) {
      await flushable.flush();
    }
  }
}
