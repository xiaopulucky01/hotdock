import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventBusService } from '../event-bus/event-bus.service';
import { IdentityService } from '../identity/identity.service';
import { ApiKeyService } from '../identity/api-key.service';

export interface RealtimeMessage {
  type: string;
  payload?: unknown;
  tenantId?: string;
  correlationId?: string;
  at: string;
}

interface ClientMeta {
  ws: WebSocket;
  userId?: string;
  tenantId?: string;
  channels: Set<string>;
}

/**
 * Realtime fan-out via WebSocket + in-process SSE subscribers.
 */
@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);
  private wss?: WebSocketServer;
  private clients = new Set<ClientMeta>();
  private sse = new Set<(msg: RealtimeMessage) => void>();
  private unsubEvent?: () => void;

  constructor(
    private readonly events: EventBusService,
    private readonly identity: IdentityService,
    private readonly apiKeys: ApiKeyService,
  ) {}

  onModuleInit() {
    this.unsubEvent = this.events.onAny((event) => {
      this.broadcast({
        type: `event:${event.name}`,
        payload: event.payload,
        tenantId: event.tenantId,
        correlationId: event.correlationId,
        at: new Date().toISOString(),
      });
    });
  }

  onModuleDestroy() {
    this.unsubEvent?.();
    this.wss?.close();
    for (const c of this.clients) {
      try {
        c.ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  /** Attach WS server to existing Nest HTTP server. */
  bindHttpServer(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/api/platform/ws' });
    this.wss.on('connection', (ws, req) => {
      void this.handleConnection(ws, req);
    });
    this.logger.log('WebSocket listening on /api/platform/ws');
  }

  private authenticateRequest(req: IncomingMessage) {
    const url = new URL(req.url ?? '', 'http://localhost');
    const token =
      url.searchParams.get('token') ??
      req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    try {
      if (token.startsWith('hdk_')) {
        return this.apiKeys.authenticate(token);
      }
      return this.identity.authenticate(`Bearer ${token}`);
    } catch {
      return null;
    }
  }

  private async handleConnection(ws: WebSocket, req: IncomingMessage) {
    const user = this.authenticateRequest(req);
    if (!user) {
      ws.close(4401, 'unauthorized');
      return;
    }
    const meta: ClientMeta = {
      ws,
      userId: user.id,
      tenantId: user.tenantId,
      channels: new Set(['platform', `user:${user.id}`]),
    };
    if (user.tenantId) meta.channels.add(`tenant:${user.tenantId}`);
    this.clients.add(meta);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw)) as {
          action?: string;
          channel?: string;
        };
        if (msg.action === 'subscribe' && msg.channel) {
          meta.channels.add(msg.channel);
        }
        if (msg.action === 'unsubscribe' && msg.channel) {
          meta.channels.delete(msg.channel);
        }
      } catch {
        /* ignore bad frames */
      }
    });
    ws.on('close', () => this.clients.delete(meta));
    ws.send(
      JSON.stringify({
        type: 'realtime.welcome',
        payload: { channels: [...meta.channels] },
        at: new Date().toISOString(),
      }),
    );
  }

  subscribeSse(handler: (msg: RealtimeMessage) => void) {
    this.sse.add(handler);
    return () => this.sse.delete(handler);
  }

  broadcast(message: RealtimeMessage, channel = 'platform') {
    const raw = JSON.stringify(message);
    for (const c of this.clients) {
      if (message.tenantId && c.tenantId && message.tenantId !== c.tenantId) {
        continue;
      }
      if (!c.channels.has(channel) && !c.channels.has('platform')) continue;
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(raw);
      }
    }
    for (const handler of this.sse) {
      try {
        handler(message);
      } catch {
        /* ignore */
      }
    }
  }

  publish(
    type: string,
    payload?: unknown,
    opts?: { tenantId?: string; channel?: string; correlationId?: string },
  ) {
    this.broadcast(
      {
        type,
        payload,
        tenantId: opts?.tenantId,
        correlationId: opts?.correlationId,
        at: new Date().toISOString(),
      },
      opts?.channel ?? 'platform',
    );
  }

  stats() {
    return {
      wsClients: this.clients.size,
      sseSubscribers: this.sse.size,
    };
  }
}
