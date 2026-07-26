# Headless WebRTC Broadcaster

The broadcaster service runs the existing authoritative game simulation in
headless Chrome. It does not create the canvas presentation, HUD, audio output,
local input listeners, or broadcaster controls. WebRTC packets, simulation,
scores, replay history, observers, and reconnection use the existing code paths.

## Network Contract

- Public hostname: `https://broadcaster.battlecities.com`
- Local service: `http://127.0.0.1:7777`
- Default player frontend: `https://battlecities.com`
- Default API: `https://api.battlecities.com`

The public hostname should reverse-proxy to `127.0.0.1:7777`. The service binds
to loopback by default and proxies its local headless browser's `/api/*` calls
to the Vercel API.

## Start

```sh
npm run build
BROADCASTER_SERVICE_TOKEN=replace-me npm run broadcaster:headless
```

PowerShell:

```powershell
$env:BROADCASTER_SERVICE_TOKEN = 'replace-me'
npm run broadcaster:headless
```

Optional environment variables:

- `BROADCASTER_HOST` defaults to `127.0.0.1`.
- `BROADCASTER_PORT` defaults to `7777`.
- `BROADCASTER_PUBLIC_URL` defaults to
  `https://broadcaster.battlecities.com`.
- `BATTLECITY_CLIENT_URL` defaults to `https://battlecities.com`.
- `BATTLECITY_API_URL` defaults to `https://api.battlecities.com`.
- `CHROME_PATH` overrides Chrome or Chromium discovery.
- `CHROME_NO_SANDBOX=1` disables Chrome's sandbox. Use this only inside an
  already isolated container that must run as root, not on a normal EC2 host.

## Service API

Health does not require authentication:

```sh
curl http://127.0.0.1:7777/health
```

Create a match:

```sh
curl -X POST http://127.0.0.1:7777/matches \
  -H "Authorization: Bearer replace-me" \
  -H "Content-Type: application/json" \
  -d '{"matchId":"test-1","level":1}'
```

The response is an operator-only lifecycle record. Player runtime configuration
is created by the Vercel API and never uses these internal URLs. Omit `matchId`
to generate one.

List and inspect matches:

```sh
curl -H "Authorization: Bearer replace-me" \
  http://127.0.0.1:7777/matches

curl -H "Authorization: Bearer replace-me" \
  http://127.0.0.1:7777/matches/test-1
```

Stop a match:

```sh
curl -X DELETE \
  -H "Authorization: Bearer replace-me" \
  http://127.0.0.1:7777/matches/test-1
```

Each match runs in a separate Chrome process and profile. The service injects
its token only into the loopback headless URL so Chrome can authenticate
signaling and submit authoritative final scores. The Vercel API persists that
result and calls `DELETE /matches/:matchId` to stop the worker. Stopping the
service stops every match.

## Reverse Proxy

An Nginx server block can proxy the hostname without exposing port `7777`:

```nginx
server {
    listen 443 ssl http2;
    server_name broadcaster.battlecities.com;

    location / {
        proxy_pass http://127.0.0.1:7777;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

TLS certificate configuration is intentionally omitted because it depends on
the EC2 certificate and deployment setup.
