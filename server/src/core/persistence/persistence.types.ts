export interface PersistenceAdapter {
  load<T = unknown>(collection: string): Promise<T | undefined>;
  save<T = unknown>(collection: string, data: T): Promise<void>;
  delete(collection: string): Promise<void>;
  listCollections(): Promise<string[]>;
}

export const PERSISTENCE_ADAPTER = Symbol('PERSISTENCE_ADAPTER');
