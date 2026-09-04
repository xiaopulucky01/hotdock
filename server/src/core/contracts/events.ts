export const PLATFORM_EVENTS = {
  MODULE_REGISTERED: 'platform.module.registered',
  MODULE_INSTALLED: 'platform.module.installed',
  MODULE_ENABLED: 'platform.module.enabled',
  MODULE_DISABLED: 'platform.module.disabled',
  MODULE_UNINSTALLED: 'platform.module.uninstalled',
  USER_CREATED: 'platform.user.created',
  USER_UPDATED: 'platform.user.updated',
  AUDIT_RECORDED: 'platform.audit.recorded',
} as const;

export type PlatformEventName =
  (typeof PLATFORM_EVENTS)[keyof typeof PLATFORM_EVENTS];

export interface PlatformEvent<T = unknown> {
  name: string;
  payload: T;
  /** Emitting module name */
  source: string;
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  occurredAt: Date;
}

export type EventHandler<T = unknown> = (
  event: PlatformEvent<T>,
) => void | Promise<void>;
