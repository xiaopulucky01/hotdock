import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type JobHandler = (payload?: unknown) => void | Promise<void>;

export interface JobDef {
  name: string;
  module: string;
  /** Cron-like interval in ms for in-memory scheduler */
  intervalMs: number;
  handler: JobHandler;
  enabled?: boolean;
}

interface RunningJob extends JobDef {
  timer?: NodeJS.Timeout;
  lastRunAt?: Date;
  lastError?: string;
}

@Injectable()
export class JobSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly jobs = new Map<string, RunningJob>();

  register(def: JobDef) {
    const key = `${def.module}:${def.name}`;
    if (this.jobs.has(key)) {
      this.unregister(def.module, def.name);
    }
    const job: RunningJob = { ...def, enabled: def.enabled ?? true };
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
      .map(({ handler: _h, timer: _t, ...rest }) => rest);
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
    job.timer = setInterval(() => {
      void this.run(key);
    }, job.intervalMs);
  }

  private stop(key: string) {
    const job = this.jobs.get(key);
    if (job?.timer) {
      clearInterval(job.timer);
      job.timer = undefined;
    }
  }

  private async run(key: string) {
    const job = this.jobs.get(key);
    if (!job) return;
    try {
      await job.handler();
      job.lastRunAt = new Date();
      job.lastError = undefined;
    } catch (err) {
      job.lastError = (err as Error).message;
      this.logger.error(`Job ${key} failed: ${job.lastError}`);
    }
  }
}
