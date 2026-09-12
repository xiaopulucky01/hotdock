export interface DocumentMeta {
  id: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency version */
  version: number;
}

export type DocumentRecord<T extends Record<string, unknown> = Record<string, unknown>> =
  DocumentMeta & T;

export interface DocumentQuery {
  tenantId?: string;
  /** Exact match filters on top-level fields */
  where?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface DocumentPage<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface CollectionStore<T extends Record<string, unknown> = Record<string, unknown>> {
  docs: DocumentRecord<T>[];
}
