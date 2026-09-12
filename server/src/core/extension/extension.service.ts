import { Injectable } from '@nestjs/common';
import {
  ExtensionContribution,
  ExtensionHandlerContribution,
} from '../contracts';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

export type PipelineMode = 'all' | 'first' | 'waterfall' | 'merge';

export interface PipelineOptions {
  mode?: PipelineMode;
  /**
   * waterfall: handler may return { __halt: true, value } to stop
   * merge: shallow-merge object results into accumulator
   */
  initial?: unknown;
  features?: FeatureFlagService;
}

/**
 * Extension points with contribution lists + ordered handler pipelines.
 */
@Injectable()
export class ExtensionService {
  private readonly contributions = new Map<string, ExtensionContribution[]>();
  private readonly handlers = new Map<
    string,
    ExtensionHandlerContribution[]
  >();

  contribute<T>(slot: string, contribution: ExtensionContribution<T>) {
    const list = this.contributions.get(slot) ?? [];
    const next = list.filter((c) => c.id !== contribution.id);
    next.push(contribution as ExtensionContribution);
    next.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.contributions.set(slot, next);
  }

  removeContribution(slot: string, id: string) {
    const list = this.contributions.get(slot) ?? [];
    this.contributions.set(
      slot,
      list.filter((c) => c.id !== id),
    );
  }

  removeModule(module: string) {
    for (const [slot, list] of this.contributions.entries()) {
      this.contributions.set(
        slot,
        list.filter((c) => c.module !== module),
      );
    }
    for (const [slot, list] of this.handlers.entries()) {
      this.handlers.set(
        slot,
        list.filter((c) => c.module !== module),
      );
    }
  }

  list<T = unknown>(
    slot: string,
    features?: FeatureFlagService,
  ): ExtensionContribution<T>[] {
    const list = (this.contributions.get(slot) ??
      []) as ExtensionContribution<T>[];
    if (!features) return list;
    return list.filter(
      (c) => !c.feature || features.isEnabled(c.feature, true),
    );
  }

  registerHandler<TContext, TResult>(
    slot: string,
    contribution: ExtensionHandlerContribution<TContext, TResult>,
  ) {
    const list = this.handlers.get(slot) ?? [];
    const next = list.filter((c) => c.id !== contribution.id);
    next.push(contribution as ExtensionHandlerContribution);
    next.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.handlers.set(slot, next);
  }

  /** Run all handlers sequentially; collect results. */
  async invokeAll<TContext, TResult>(
    slot: string,
    context: TContext,
  ): Promise<TResult[]> {
    return this.invokePipeline<TContext, TResult>(slot, context, {
      mode: 'all',
    }) as Promise<TResult[]>;
  }

  /**
   * Ordered handler chain with short-circuit / merge semantics.
   */
  async invokePipeline<TContext, TResult = unknown>(
    slot: string,
    context: TContext,
    opts: PipelineOptions = {},
  ): Promise<TResult | TResult[]> {
    const mode = opts.mode ?? 'all';
    let list = this.handlers.get(slot) ?? [];
    if (opts.features) {
      list = list.filter(
        (h) => !h.feature || opts.features!.isEnabled(h.feature, true),
      );
    }

    if (mode === 'first') {
      for (const item of list) {
        const result = await item.handler(context);
        if (result !== undefined && result !== null) {
          return result as TResult;
        }
      }
      return undefined as TResult;
    }

    if (mode === 'waterfall') {
      let acc = opts.initial ?? context;
      for (const item of list) {
        const result = (await item.handler(acc)) as
          | TResult
          | { __halt?: boolean; value?: TResult };
        if (
          result &&
          typeof result === 'object' &&
          (result as { __halt?: boolean }).__halt
        ) {
          return (result as { value?: TResult }).value as TResult;
        }
        acc = result as TContext;
      }
      return acc as TResult;
    }

    if (mode === 'merge') {
      let acc: Record<string, unknown> =
        (opts.initial as Record<string, unknown>) ?? {};
      for (const item of list) {
        const result = await item.handler({ ...context, ...acc });
        if (result && typeof result === 'object' && !Array.isArray(result)) {
          acc = { ...acc, ...(result as Record<string, unknown>) };
        }
      }
      return acc as TResult;
    }

    // all
    const results: TResult[] = [];
    for (const item of list) {
      results.push((await item.handler(context)) as TResult);
    }
    return results;
  }

  listSlots(): string[] {
    return [
      ...new Set([...this.contributions.keys(), ...this.handlers.keys()]),
    ];
  }

  listHandlers(slot: string) {
    return (this.handlers.get(slot) ?? []).map(
      ({ handler: _h, ...rest }) => rest,
    );
  }
}
