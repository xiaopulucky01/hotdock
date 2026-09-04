import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagService {
  private readonly flags = new Map<string, boolean>();

  constructor() {
    this.set('platform.audit.enabled', true);
    this.set('platform.rateLimit.enabled', true);
  }

  isEnabled(flag: string, defaultValue = false): boolean {
    return this.flags.has(flag) ? !!this.flags.get(flag) : defaultValue;
  }

  set(flag: string, enabled: boolean) {
    this.flags.set(flag, enabled);
  }

  list(): Record<string, boolean> {
    return Object.fromEntries(this.flags.entries());
  }
}
