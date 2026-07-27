# Headless WebRTC Broadcaster

The broadcaster is a pure Node.js service. It runs one independent
`BattleCitySimulation` and WebRTC peer pipeline per active match. It does not
launch Chrome, create a canvas, render a HUD, initialize audio, or accept local
game input.

The simulation and packet types live in `shared/src`, so Node and browser code
compile against the same authoritative contract.

## Network Contract

- Public hostname: `https://broadcaster.battlecities.com`
- Local service: `http://127.0.0.1:7777`
- Signaling API: `https://api.battlecities.com`

The public hostname should reverse-proxy to `127.0.0.1:7777`. The broadcaster
uses the existing HTTP WebRTC signaling endpoints directly.

## Start

For the complete frontend Vercel, API Vercel, and Windows environment setup,
see [Deployment Environment Setup](environment-setup.md).

```powershell
$env:BROADCASTER_SERVICE_TOKEN = 'same-secret-used-by-the-vercel-api'
$env:BROADCASTER_API_URL = 'https://api.battlecities.com'
$env:BROADCASTER_PUBLIC_URL = 'https://broadcaster.battlecities.com'
$env:BROADCASTER_CLIENT_URL = 'https://battlecities.com'
$env:BROADCASTER_HOST = '127.0.0.1'
$env:BROADCASTER_PORT = '7777'
npm run broadcaster:headless
```

Optional environment variables:

- `BROADCASTER_HOST` defaults to `127.0.0.1`.
- `BROADCASTER_PORT` defaults to `7777`.
- `BROADCASTER_API_URL` defaults to `http://127.0.0.1:3000`.
- `BROADCASTER_PUBLIC_URL` defaults to the local service URL.
- `BROADCASTER_CLIENT_URL` defaults to `https://battlecities.com` and controls
  the observer frontend opened by the monitor.
- `BROADCASTER_DISABLE_ENEMY_SHOOTING=1` disables authoritative enemy firing.

`BROADCASTER_SERVICE_TOKEN` is required in production and must match the API's
token. It authenticates lifecycle and signaling requests.

## Service API

Open the operator monitor at `http://127.0.0.1:7777/monitor`. Enter the
`BROADCASTER_SERVICE_TOKEN` to list all active matches. The View action opens
the selected match through the configured client frontend in observer mode.

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

List, inspect, and stop matches:

```sh
curl -H "Authorization: Bearer replace-me" http://127.0.0.1:7777/matches
curl -H "Authorization: Bearer replace-me" http://127.0.0.1:7777/matches/test-1
curl -X DELETE -H "Authorization: Bearer replace-me" http://127.0.0.1:7777/matches/test-1
```

The API creates player runtime configuration separately. Creating a match here
starts signaling peers immediately, but the simulation clock does not advance
until both player data channels are connected. A player disconnect does not
stop simulation or observer frames. Reconnection uses the complete in-memory
frame history and the existing replay-ready handshake.

## Reverse Proxy

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
