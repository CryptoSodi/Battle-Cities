# Cloudflare WebSocket game runtime

This Worker runs one authoritative headless match per Durable Object. It keeps
the existing WebRTC packet names so the game simulation and client processing
remain transport-independent. Frames are sent after every simulation tick;
there is no snapshot batching or interpolation.

## Local check

1. Copy `.dev.vars.example` to `.dev.vars` and set both secrets.
2. Run `npm run cloudflare:check`.
3. Run `npm run cloudflare:dev`.
4. Open `http://localhost:8787/ws-latency.html`.

## Oracle API configuration

Keep WebRTC active by leaving `MULTIPLAYER_TRANSPORT` unset. To assign new
matches to the Worker, configure the Oracle API with:

```text
MULTIPLAYER_TRANSPORT=websocket
WEBSOCKET_BASE_URL=https://<worker-hostname>
WEBSOCKET_BROADCASTER_BASE_URL=https://<worker-hostname>
WEBSOCKET_TICKET_SECRET=<same Worker secret>
```

`BROADCASTER_SERVICE_TOKEN` must also be the same in Oracle and the Worker.
The Oracle API remains the system of record for matchmaking and results.

## Worker secrets

Set secrets through Wrangler; never put their values in `wrangler.jsonc`:

```powershell
npx wrangler secret put BROADCASTER_SERVICE_TOKEN --config cloudflare-game-worker/wrangler.jsonc
npx wrangler secret put WEBSOCKET_TICKET_SECRET --config cloudflare-game-worker/wrangler.jsonc
```

The diagnostic page is deployed at `/ws-latency.html`. Its region display is
the Cloudflare request ingress colo. Durable Object placement is managed by
Cloudflare and is not exposed as a guaranteed physical server address.
