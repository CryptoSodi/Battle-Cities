# Embedded authoritative WebRTC broadcaster

The broadcaster is a pure Node/`werift` authoritative simulation. Production
runs it inside the API Node process rather than on a separate host or port.

## Production runtime

`api-server/src/index.ts` imports the compiled broadcaster when
`BATTLECITY_EMBED_BROADCASTER=1`. The same HTTP server on port `3001` dispatches
both API and broadcaster requests.

```env
BATTLECITY_EMBED_BROADCASTER=1
BROADCASTER_BASE_URL=http://127.0.0.1:3001
BROADCASTER_API_URL=http://127.0.0.1:3001
BROADCASTER_PUBLIC_URL=https://api.battlecities.com
BROADCASTER_CLIENT_URL=https://www.battlecities.com
```

Embedded mode generates its private service token automatically in memory.

Build and start:

```bash
npm run server:build
npm run server:start
```

No second `npm start`, port `7777`, Cloudflare tunnel, or broadcaster DNS record
is required.

## Runtime routes

Public monitor and health routes are served from `api.battlecities.com`:

```text
GET /
GET /monitor
GET /live
GET /live/matches
GET /live/past-matches
GET /health
```

Match-control routes under `/matches` and `/past-matches` require the
automatically generated bearer token. Players never receive it. Player
signaling remains under the authenticated API routes.

Production Caddy also returns `404` for external requests to these control
paths. Only loopback calls made by the combined API process reach them.

## Lifecycle and persistence

- Match simulations and WebRTC peer objects are in memory.
- Match assignments and broadcaster lifecycle state are in PostgreSQL.
- Authoritative frames/results are archived through PostgreSQL archive tables.
- Graceful `SIGTERM` stops matches and flushes archive state before the API
  process exits.
- A process restart ends active in-memory matches; clients use the existing
  reconnect/match state flow after service recovery.

## Standalone compatibility mode

`npm run broadcaster:headless` remains available for focused local testing and
the broadcaster test suite. Standalone mode still requires an explicitly set
`BROADCASTER_SERVICE_TOKEN`; it is not used by the Ubuntu deployment.
