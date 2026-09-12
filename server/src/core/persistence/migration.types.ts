export interface Migration {
  /** Unique id, e.g. "ai-chat.001_init" */
  id: string;
  module: string;
  description?: string;
  up: () => void | Promise<void>;
  down?: () => void | Promise<void>;
}

export interface MigrationState {
  applied: Array<{ id: string; module: string; appliedAt: string }>;
}
