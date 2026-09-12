import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import * as cron from 'node-cron';
import { PersistenceService } from '../persistence/persistence.service';
import { LockService } from '../distributed/lock.service';

export type JobHandler = (payload?: unknown) => void | Promise<void>;

export interface JobDef {
  name: string;
  module: string;
  /** Interval in ms (used when cron is not set) */
  intervalMs?: number;
  /** Standard 5-field cron expression */
  cron?: string;
  handler: JobHandler;
  enabled?: boolean;
  /** Max retries on failure */
  retries?: number;
}

export interface JobScheduleUpdate {
  enabled?: boolean;
  intervalMs?: number;
  /** Pass null to clear cron in favor of intervalMs */
  cron?: string | null;
}

interface JobOverride {
  enabled?: boolean;
  intervalMs?: number;
  cron?: string | null;
}

interface RunningJob extends Omit<JobDef, 'intervalMs'> {
  intervalMs?: number;
  timer?: NodeJS.Timeout;
  cronTask?: cron.ScheduledTask;
  lastRunAt?: Date;
  lastError?: string;
  runCount: number;
  failCount: number;
}

@Injectable()
export class JobSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly jobs = new Map<string, RunningJob>();
  private overrides = new Map<string, JobOverride>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    @Optional() private readonly locks?: LockService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data =
      await this.persistence.load<Record<string, JobOverride>>('jobs');
    if (data) {
      for (const [k, v] of Object.entries(data)) {
        this.overrides.set(k, v);
      }
    }
  }

  private async persistOverrides() {
    await this.persistence.save(
      'jobs',
      Object.fromEntries(this.overrides.entries()),
    );
  }

  private mergeOverride(key: string, patch: JobOverride) {
    const prev = this.overrides.get(key) ?? {};
    const next: JobOverride = { ...prev, ...patch };
    if (patch.cron !== undefined) {
      if (patch.cron) {
        delete next.intervalMs;
      } else {
        next.cron = null;
      }
    }
    if (patch.intervalMs !== undefined && patch.cron === undefined) {
      next.cron = null;
    }
    this.overrides.set(key, next);
    void this.persistOverrides();
  }

  private applyOverride(job: RunningJob, key: string) {
    const override = this.overrides.get(key);
    if (!override) return;
    if (typeof override.enabled === 'boolean') {
      job.enabled = override.enabled;
    }
    if (override.cron) {
      job.cron = override.cron;
      job.intervalMs = undefined;
    } else if (typeof override.intervalMs === 'number') {
      job.intervalMs = override.intervalMs;
      job.cron = undefined;
    }
  }

  register(def: JobDef) {
    const key = `${def.module}:${def.name}`;
    if (this.jobs.has(key)) {
      this.unregister(def.module, def.name);
    }
    if (!def.intervalMs && !def.cron) {
      throw new Error(`Job ${key} requires intervalMs or cron`);
    }
    const job: RunningJob = {
      ...def,
      enabled: def.enabled ?? true,
      runCount: 0,
      failCount: 0,
    };
    this.applyOverride(job, key);
    if (!job.intervalMs && !job.cron) {
      throw new Error(`Job ${key} requires intervalMs or cron after overrides`);
    }
    this.jobs.set(key, job);
    if (job.enabled) {
      this.start(key);
    }
    return key;
  }

  unregister(module: string, name: string) {
    const key = `${module}:${name}`;
    this.stop(key);
    this.jobs.delete(key);
  }

  unregisterModule(module: string) {
    for (const key of [...this.jobs.keys()]) {
      if (key.startsWith(`${module}:`)) {
        this.stop(key);
        this.jobs.delete(key);
      }
    }
  }

  list(module?: string) {
    return [...this.jobs.values()]
      .filter((j) => !module || j.module === module)
      .map(
        ({
          handler: _h,
          timer: _t,
          cronTask: _c,
          ...rest
        }) => rest,
      );
  }

  get(module: string, name: string) {
    const job = this.jobs.get(`${module}:${name}`);
    if (!job) {
      throw new NotFoundException(`Job ${module}:${name} not found`);
    }
    const {
      handler: _h,
      timer: _t,
      cronTask: _c,
      ...rest
    } = job;
    return rest;
  }

  update(module: string, name: string, patch: JobScheduleUpdate) {
    const key = `${module}:${name}`;
    const job = this.jobs.get(key);
    if (!job) {
      throw new NotFoundException(`Job ${key} not found`);
    }

    const hasSchedule =
      patch.intervalMs !== undefined || patch.cron !== undefined;
    if (!hasSchedule && patch.enabled === undefined) {
      throw new BadRequestException('No changes provided');
    }

    if (hasSchedule) {
      if (patch.cron) {
        if (!cron.validate(patch.cron)) {
          throw new BadRequestException(
            `Invalid cron expression: ${patch.cron}`,
          );
        }
        job.cron = patch.cron;
        job.intervalMs = undefined;
        this.mergeOverride(key, { cron: patch.cron });
      } else if (typeof patch.intervalMs === 'number') {
        if (patch.intervalMs < 100) {
          throw new BadRequestException('intervalMs must be >= 100');
        }
        job.intervalMs = patch.intervalMs;
        job.cron = undefined;
        this.mergeOverride(key, { intervalMs: patch.intervalMs, cron: null });
      } else if (patch.cron === null) {
        if (typeof patch.intervalMs !== 'number' && !job.intervalMs) {
          throw new BadRequestException(
            'Clearing cron requires intervalMs',
          );
        }
        if (typeof patch.intervalMs === 'number') {
          if (patch.intervalMs < 100) {
            throw new BadRequestException('intervalMs must be >= 100');
          }
          job.intervalMs = patch.intervalMs;
        }
        job.cron = undefined;
        this.mergeOverride(key, {
          intervalMs: job.intervalMs,
          cron: null,
        });
      } else {
        throw new BadRequestException('Provide intervalMs or a cron expression');
      }
    }

    if (typeof patch.enabled === 'boolean') {
      job.enabled = patch.enabled;
      this.mergeOverride(key, { enabled: patch.enabled });
    }

    if (job.enabled) {
      this.start(key);
    } else {
      this.stop(key);
    }

    return this.get(module, name);
  }

  trigger(module: string, name: string) {
    const key = `${module}:${name}`;
    if (!this.jobs.has(key)) {
      throw new NotFoundException(`Job ${key} not found`);
    }
    void this.run(key);
    return this.get(module, name);
  }

  onModuleDestroy() {
    for (const key of this.jobs.keys()) {
      this.stop(key);
    }
  }

  private start(key: string) {
    const job = this.jobs.get(key);
    if (!job) return;
    this.stop(key);

    if (job.cron) {
      if (!cron.validate(job.cron)) {
        throw new Error(`Invalid cron expression for job ${key}: ${job.cron}`);
      }
      job.cronTask = cron.schedule(job.cron, () => {
        void this.run(key);
      });
      return;
    }

    job.timer = setInterval(() => {
      void this.run(key);
    }, job.intervalMs!);
  }

  private stop(key: string) {
    const job = this.jobs.get(key);
    if (!job) return;
    if (job.timer) {
      clearInterval(job.timer);
      job.timer = undefined;
    }
    if (job.cronTask) {
      job.cronTask.stop();
      job.cronTask = undefined;
    }
  }

  private async run(key: string) {
    const job = this.jobs.get(key);
    if (!job || !job.enabled) return;

    const execute = async () => {
      const retries = job.retries ?? 1;
      let attempt = 0;
      while (attempt <= retries) {
        try {
          await job.handler();
          job.lastRunAt = new Date();
          job.lastError = undefined;
          job.runCount += 1;
          return;
        } catch (err) {
          attempt += 1;
          job.lastError = (err as Error).message;
          if (attempt > retries) {
            job.failCount += 1;
            this.logger.error(`Job ${key} failed: ${job.lastError}`);
          } else {
            await new Promise((r) => setTimeout(r, 100 * attempt));
          }
        }
      }
    };

    // Distributed lock so only one instance runs a given job at a time
    if (this.locks) {
      const result = await this.locks.withLock(
        `job:${key}`,
        60_000,
        execute,
        { waitMs: 0 },
      );
      if (result === undefined) {
        this.logger.debug(`Job ${key} skipped — lock held elsewhere`);
      }
      return;
    }
    await execute();
  }
}
