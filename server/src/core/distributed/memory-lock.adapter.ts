import { Injectable } from '@nestjs/common';
import { LockAdapter } from './lock.types';

interface LockEntry {
  token: string;
  expiresAt: number;
}

@Injectable()
export class MemoryLockAdapter implements LockAdapter {
  private readonly locks = new Map<string, LockEntry>();

  async acquire(key: string, ttlMs: number, token: string): Promise<boolean> {
    const now = Date.now();
    const cur = this.locks.get(key);
    if (cur && cur.expiresAt > now && cur.token !== token) {
      return false;
    }
    this.locks.set(key, { token, expiresAt: now + ttlMs });
    return true;
  }

  async release(key: string, token: string): Promise<boolean> {
    const cur = this.locks.get(key);
    if (!cur || cur.token !== token) return false;
    this.locks.delete(key);
    return true;
  }

  async extend(key: string, token: string, ttlMs: number): Promise<boolean> {
    const cur = this.locks.get(key);
    if (!cur || cur.token !== token || cur.expiresAt < Date.now()) return false;
    cur.expiresAt = Date.now() + ttlMs;
    return true;
  }
}
