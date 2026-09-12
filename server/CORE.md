# Hotdock Core Engine

Hotdock is a NestJS **platform kernel** for hot-pluggable business modules.

## L0 Kernel capabilities

| Area | What you get |
|---|---|
| Plugin runtime | Discover → load → mount/unmount HTTP routes without host restart |
| Persistence | File adapter + `DocumentRepository` (tenant-scoped, optimistic versioning) + migrations |
| Secrets | AES-256-GCM encryption for config secrets (`SECRETS_MASTER_KEY`) |
| Cache / locks | Memory default; Redis when `REDIS_URL` is set; file locks for single-host multi-process |
| Events | In-process bus + durable **outbox** (`EVENT_OUTBOX=0` to disable) |
| Jobs | Cron/interval scheduler with **distributed lock** per job |
| Commands | Cross-module `CommandBusService` (avoid direct plugin imports) |
| Workflows | Lightweight step runner with compensation hooks |
| Extensions | Contribution slots + pipelines (`all` / `first` / `waterfall` / `merge`) |
| Identity | JWT + refresh revoke + **API keys** + **OAuth2/OIDC** providers |
| RBAC + ACL | Permission strings + resource-level ACL |
| Tenancy | Tenants, **quotas**, **module grants**, **config overrides** |
| Realtime | WebSocket `/api/platform/ws` + SSE `/api/platform/realtime/sse` |
| Observability | Health, traces, Prometheus `/api/platform/metrics/prometheus`, backups |
| Plugin pack | Core API `1.0.0`, capability declarations, package validation |
| SDK | `src/sdk` — stable imports for plugin authors |

## Environment

| Variable | Purpose |
|---|---|
| `DATA_DIR` | Persistence root (default `.data/`) |
| `JWT_SECRET` / `SECRETS_MASTER_KEY` | Auth + secret encryption |
| `REDIS_URL` | Enable Redis cache + distributed locks |
| `LOCK_BACKEND=memory` | Force in-process locks |
| `EVENT_OUTBOX=0` | Sync event delivery (useful in tests) |
| `HOTDOCK_PLUGINS_DIR` | External plugin drop-in directory |
| `RATE_LIMIT_MAX` | Default RPM (tenant quota can override) |

## Plugin authoring

```ts
import { createPlugin } from '../../sdk';

export default createPlugin({
  manifest: {
    name: 'my-mod',
    version: '1.0.0',
    displayName: 'My Module',
    coreApi: '^1.0.0',
    capabilities: ['persistence.write', 'events.emit'],
  },
  module: MyModule,
  lifecycle: MyLifecycle,
});
```

Use `DocumentRepository`, `EventBusService`, `CommandBusService`, `ExtensionService.invokePipeline`, etc. from the SDK — not deep `core/*` paths.

CLI: `node bin/hotdock.js doctor|core-api|scaffold <name>`

## Production notes

1. Set `JWT_SECRET` and `SECRETS_MASTER_KEY`.
2. Set `REDIS_URL` for multi-instance cache/locks/rate-limit.
3. Prefer DB-backed persistence adapter when leaving the file prototype (interface is ready; swap `PERSISTENCE_ADAPTER`).
4. Backups: `POST /api/platform/backups` then restore via `:id/restore`.
