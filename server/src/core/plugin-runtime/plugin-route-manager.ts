import { Injectable, Logger } from '@nestjs/common';
import type { HttpServer } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { RoutesResolver } from '@nestjs/core/router/routes-resolver';
import type { Module } from '@nestjs/core/injector/module';

type ExpressLayer = {
  name?: string;
  route?: { path?: string };
  regexp?: { source?: string };
  handle?: unknown;
};

/**
 * Mounts / unmounts Nest controllers onto the HTTP adapter after lazy load.
 * Nest's LazyModuleLoader instantiates controllers but does not register routes.
 *
 * Important: Nest already registered 404/error handlers at the end of the Express
 * stack during bootstrap. New routes must be inserted *before* those handlers.
 */
@Injectable()
export class PluginRouteManager {
  private readonly logger = new Logger(PluginRouteManager.name);
  private routesResolver?: RoutesResolver;
  private httpAdapter?: HttpServer;
  private readonly mountedLayers = new Map<string, ExpressLayer[]>();

  bindApplication(app: INestApplication) {
    const nestApp = app as unknown as {
      container: ConstructorParameters<typeof RoutesResolver>[0];
      config: ConstructorParameters<typeof RoutesResolver>[1];
      injector: ConstructorParameters<typeof RoutesResolver>[2];
      graphInspector: ConstructorParameters<typeof RoutesResolver>[3];
    };
    this.routesResolver = new RoutesResolver(
      nestApp.container,
      nestApp.config,
      nestApp.injector,
      nestApp.graphInspector,
    );
    this.httpAdapter = app.getHttpAdapter();
  }

  isBound() {
    return Boolean(this.routesResolver && this.httpAdapter);
  }

  isMounted(name: string) {
    return this.mountedLayers.has(name);
  }

  mount(name: string, nestModule: Module) {
    if (!this.routesResolver || !this.httpAdapter) {
      throw new Error('PluginRouteManager is not bound to NestApplication');
    }
    if (this.mountedLayers.has(name)) {
      return;
    }

    const stack = this.getExpressStack();
    let terminal: ExpressLayer[] = [];
    let before = 0;

    if (stack) {
      const insertAt = this.findTerminalStartIndex(stack);
      terminal = stack.splice(insertAt);
      before = stack.length;
    }

    this.routesResolver.registerRouters(
      nestModule.controllers,
      nestModule.token,
      '',
      '',
      this.httpAdapter,
    );

    if (stack) {
      const added = stack.slice(before);
      stack.push(...terminal);
      this.mountedLayers.set(name, added);
      this.logger.log(
        `Mounted HTTP routes for plugin "${name}" (+${added.length} layer(s))`,
      );
    } else {
      this.mountedLayers.set(name, []);
      this.logger.warn(
        `Mounted plugin "${name}" but could not track Express layers for unload`,
      );
    }
  }

  unmount(name: string) {
    const layers = this.mountedLayers.get(name);
    if (!layers) return;

    const stack = this.getExpressStack();
    if (stack) {
      for (const layer of layers) {
        const idx = stack.indexOf(layer);
        if (idx >= 0) stack.splice(idx, 1);
      }
    }
    this.mountedLayers.delete(name);
    this.logger.log(`Unmounted HTTP routes for plugin "${name}"`);
  }

  /**
   * Index where Nest's trailing not-found / error middlewares begin
   * (layers after the last real route).
   */
  private findTerminalStartIndex(stack: ExpressLayer[]): number {
    let i = stack.length - 1;
    while (i >= 0 && !stack[i].route) {
      i -= 1;
    }
    return i + 1;
  }

  private getExpressStack(): ExpressLayer[] | null {
    if (!this.httpAdapter) return null;
    const instance = this.httpAdapter.getInstance?.() as {
      router?: { stack?: ExpressLayer[] };
      _router?: { stack?: ExpressLayer[] };
    };
    return instance?.router?.stack ?? instance?._router?.stack ?? null;
  }
}
