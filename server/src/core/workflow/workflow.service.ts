import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ExtensionService } from '../extension/extension.service';

export type WorkflowStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'compensated';

export interface WorkflowStepDef {
  id: string;
  /** Extension handler slot or command name */
  slot?: string;
  command?: string;
  compensateSlot?: string;
}

export interface WorkflowDef {
  name: string;
  module: string;
  steps: WorkflowStepDef[];
}

export interface WorkflowInstance {
  id: string;
  name: string;
  module: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  context: Record<string, unknown>;
  stepResults: Array<{
    stepId: string;
    status: WorkflowStepStatus;
    result?: unknown;
    error?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight step runner with compensation — not a full BPM engine.
 */
@Injectable()
export class WorkflowService {
  private readonly defs = new Map<string, WorkflowDef>();
  private readonly instances = new Map<string, WorkflowInstance>();

  constructor(private readonly extensions: ExtensionService) {}

  register(def: WorkflowDef) {
    this.defs.set(`${def.module}:${def.name}`, def);
  }

  unregisterModule(module: string) {
    for (const key of [...this.defs.keys()]) {
      if (key.startsWith(`${module}:`)) this.defs.delete(key);
    }
  }

  listDefs() {
    return [...this.defs.values()];
  }

  listInstances(limit = 50) {
    return [...this.instances.values()].slice(-limit);
  }

  async start(
    module: string,
    name: string,
    context: Record<string, unknown> = {},
  ): Promise<WorkflowInstance> {
    const def = this.defs.get(`${module}:${name}`);
    if (!def) throw new NotFoundException(`Workflow ${module}:${name} not found`);

    const instance: WorkflowInstance = {
      id: randomUUID(),
      name,
      module,
      status: 'running',
      context,
      stepResults: def.steps.map((s) => ({
        stepId: s.id,
        status: 'pending',
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.instances.set(instance.id, instance);

    try {
      for (let i = 0; i < def.steps.length; i++) {
        const step = def.steps[i];
        instance.stepResults[i].status = 'running';
        instance.updatedAt = new Date().toISOString();
        try {
          let result: unknown;
          if (step.slot) {
            const results = await this.extensions.invokePipeline(
              step.slot,
              instance.context,
              { mode: 'first' },
            );
            result = results;
          } else {
            result = { skipped: true, reason: 'no slot' };
          }
          instance.stepResults[i].status = 'done';
          instance.stepResults[i].result = result;
          instance.context = {
            ...instance.context,
            [`step.${step.id}`]: result,
          };
        } catch (err) {
          instance.stepResults[i].status = 'failed';
          instance.stepResults[i].error = (err as Error).message;
          instance.status = 'compensating';
          await this.compensate(instance, def, i - 1);
          instance.status = 'failed';
          instance.updatedAt = new Date().toISOString();
          return instance;
        }
      }
      instance.status = 'completed';
      instance.updatedAt = new Date().toISOString();
      return instance;
    } catch (err) {
      instance.status = 'failed';
      instance.updatedAt = new Date().toISOString();
      throw err;
    }
  }

  private async compensate(
    instance: WorkflowInstance,
    def: WorkflowDef,
    lastDoneIndex: number,
  ) {
    for (let i = lastDoneIndex; i >= 0; i--) {
      const step = def.steps[i];
      if (!step.compensateSlot) continue;
      try {
        await this.extensions.invokePipeline(
          step.compensateSlot,
          instance.context,
          { mode: 'all' },
        );
        instance.stepResults[i].status = 'compensated';
      } catch {
        // best-effort compensation
      }
    }
  }
}
