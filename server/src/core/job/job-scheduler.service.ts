import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as cron from 'node-cron';

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
export class JobSchedulerService implements OnModuleDestroy {
  private readonly logger = new Logger(JobSchedulerService.name);
  private readonly jobs = new Map<string, RunningJob>();

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
    if (!job) return;
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
  }
}
