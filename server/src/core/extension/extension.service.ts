import { Injectable } from '@nestjs/common';
import {
  ExtensionContribution,
  ExtensionHandlerContribution,
} from '../contracts';
import { FeatureFlagService } from '../feature-flag/feature-flag.service';

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

  async invokeAll<TContext, TResult>(
    slot: string,
    context: TContext,
  ): Promise<TResult[]> {
    const list = this.handlers.get(slot) ?? [];
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
}
