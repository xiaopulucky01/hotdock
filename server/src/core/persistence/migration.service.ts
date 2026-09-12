import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PersistenceService } from './persistence.service';
import { Migration, MigrationState } from './migration.types';

/**
 * Ordered schema/data migrations per module.
 * Plugins register migrations in onInstall/onEnable.
 */
@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);
  private readonly pending: Migration[] = [];
  private state: MigrationState = { applied: [] };
  private loaded = false;

  constructor(private readonly persistence: PersistenceService) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<MigrationState>('migrations');
    this.state = data ?? { applied: [] };
  }

  private async persist() {
    await this.persistence.save('migrations', this.state);
  }

  register(migration: Migration) {
    if (this.pending.some((m) => m.id === migration.id)) return;
    this.pending.push(migration);
  }

  registerMany(migrations: Migration[]) {
    for (const m of migrations) this.register(m);
  }

  isApplied(id: string) {
    return this.state.applied.some((a) => a.id === id);
  }

  listApplied() {
    return [...this.state.applied];
  }

  listPending() {
    return this.pending
      .filter((m) => !this.isApplied(m.id))
      .map(({ id, module, description }) => ({ id, module, description }));
  }

  /** Run all unapplied migrations in registration order (optionally filtered by module). */
  async up(module?: string) {
    await this.ensureLoaded();
    const queue = this.pending.filter(
      (m) => !this.isApplied(m.id) && (!module || m.module === module),
    );
    for (const m of queue) {
      this.logger.log(`Applying migration ${m.id}`);
      await m.up();
      this.state.applied.push({
        id: m.id,
        module: m.module,
        appliedAt: new Date().toISOString(),
      });
      await this.persist();
    }
    return { applied: queue.map((m) => m.id) };
  }

  async down(id: string) {
    await this.ensureLoaded();
    const migration = this.pending.find((m) => m.id === id);
    if (!migration?.down) {
      throw new Error(`Migration ${id} has no down()`);
    }
    if (!this.isApplied(id)) {
      return { rolledBack: false };
    }
    await migration.down();
    this.state.applied = this.state.applied.filter((a) => a.id !== id);
    await this.persist();
    return { rolledBack: true };
  }
}
