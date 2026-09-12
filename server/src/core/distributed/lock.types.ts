export interface DistributedLock {
  /** Release the lock (no-op if already expired / not owned). */
  release(): Promise<void>;
  /** Extend TTL while still holding. Returns false if lost. */
  extend(ttlMs: number): Promise<boolean>;
  readonly key: string;
  readonly token: string;
}

export interface LockAdapter {
  acquire(
    key: string,
    ttlMs: number,
    token: string,
  ): Promise<boolean>;
  release(key: string, token: string): Promise<boolean>;
  extend(key: string, token: string, ttlMs: number): Promise<boolean>;
}

export const LOCK_ADAPTER = Symbol('LOCK_ADAPTER');
