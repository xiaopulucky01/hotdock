import { Injectable } from '@nestjs/common';

export interface CommandContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  source?: string;
}

export type CommandHandler<TInput = unknown, TResult = unknown> = (
  input: TInput,
  ctx: CommandContext,
) => TResult | Promise<TResult>;

interface RegisteredHandler {
  module: string;
  handler: CommandHandler;
}

/**
 * Cross-module synchronous command bus (permissioned by caller convention).
 * Prefer this over direct Nest imports between plugins.
 */
@Injectable()
export class CommandBusService {
  private readonly handlers = new Map<string, RegisteredHandler>();

  register<TInput, TResult>(
    command: string,
    module: string,
    handler: CommandHandler<TInput, TResult>,
  ) {
    this.handlers.set(command, {
      module,
      handler: handler as CommandHandler,
    });
    return () => this.unregister(command);
  }

  unregister(command: string) {
    this.handlers.delete(command);
  }

  unregisterModule(module: string) {
    for (const [cmd, h] of this.handlers.entries()) {
      if (h.module === module) this.handlers.delete(cmd);
    }
  }

  has(command: string) {
    return this.handlers.has(command);
  }

  list() {
    return [...this.handlers.entries()].map(([command, h]) => ({
      command,
      module: h.module,
    }));
  }

  async execute<TResult = unknown>(
    command: string,
    input: unknown,
    ctx: CommandContext = {},
  ): Promise<TResult> {
    const registered = this.handlers.get(command);
    if (!registered) {
      throw new Error(`Command "${command}" is not registered`);
    }
    return (await registered.handler(input, ctx)) as TResult;
  }
}
