# Deployment Environment Setup

Battle Cities uses three separately configured processes. Keep their variables
separate because the frontend environment is compiled into public JavaScript.

| Project | Runs on | Purpose |
| --- | --- | --- |
| Game client | Vercel frontend project | Loads the game and calls the public API |
| API | Vercel API project | Owns accounts, matches, signaling, and broadcaster lifecycle calls |
| Headless broadcaster | Windows or a server | Runs authoritative match simulations and WebRTC peers |

## 1. Vercel Game Client

In the frontend Vercel project, open **Settings > Environment Variables** and
configure:

```env
BATTLECITY_API_BASE_URL=https://api.battlecities.com
```

Apply it to Production and Preview as needed, then redeploy the frontend. This
is a build-time variable, so changing it does not affect an existing deployment
until that deployment is rebuilt.

Never configure `BROADCASTER_SERVICE_TOKEN` or `BROADCASTER_BASE_URL` in the
frontend project. Frontend environment variables are not private secrets.

## 2. Vercel API

In the API Vercel project, configure:

```env
BROADCASTER_BASE_URL=https://broadcaster.battlecities.com
BROADCASTER_SERVICE_TOKEN=replace-with-a-strong-random-secret
```

`BROADCASTER_SERVICE_TOKEN` must be identical to the token used by the
headless broadcaster. Generate a dedicated value, keep it out of source
control, and do not reuse a user password or frontend secret.

The API project also needs its normal database, OAuth, web-origin, and storage
variables documented in [`api-server/README.md`](../api-server/README.md).
Redeploy the API after changing its environment variables.

## 3. Windows Headless Broadcaster

Open PowerShell in the repository root and set the environment for the current
terminal session:

```powershell
$env:BROADCASTER_SERVICE_TOKEN = 'same-secret-used-by-the-vercel-api'
$env:BROADCASTER_API_URL = 'https://api.battlecities.com'
$env:BROADCASTER_PUBLIC_URL = 'https://broadcaster.battlecities.com'
$env:BROADCASTER_CLIENT_URL = 'https://battlecities.com'
$env:BROADCASTER_HOST = '127.0.0.1'
$env:BROADCASTER_PORT = '7777'
$env:BROADCASTER_DISABLE_ENEMY_SHOOTING = '0'

npm run broadcaster:headless
```

These PowerShell variables last only for that terminal session. This is useful
for local testing because closing the terminal removes the secret from the
process environment.

`BROADCASTER_DISABLE_ENEMY_SHOOTING=1` is an optional test setting. Production
should use `0` or omit it.

Verify the local service from another PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:7777/health
```

The operator monitor is available at:

```text
http://127.0.0.1:7777/monitor
```

Enter the same `BROADCASTER_SERVICE_TOKEN` in the monitor login.

## Public Hostname Requirement

The Vercel API cannot reach `127.0.0.1` on the Windows machine. A reverse proxy
or tunnel must route:

```text
https://broadcaster.battlecities.com -> http://127.0.0.1:7777
```

Until that route is active, the local health check can pass while Vercel still
receives a `502` from the public broadcaster hostname.

Verify the complete public route with:

```powershell
Invoke-RestMethod https://broadcaster.battlecities.com/health
```

## Configuration Summary

| Location | Variable | Production value |
| --- | --- | --- |
| Vercel client | `BATTLECITY_API_BASE_URL` | `https://api.battlecities.com` |
| Vercel API | `BROADCASTER_BASE_URL` | `https://broadcaster.battlecities.com` |
| Vercel API | `BROADCASTER_SERVICE_TOKEN` | Shared private secret |
| Windows broadcaster | `BROADCASTER_SERVICE_TOKEN` | Same shared private secret |
| Windows broadcaster | `BROADCASTER_API_URL` | `https://api.battlecities.com` |
| Windows broadcaster | `BROADCASTER_PUBLIC_URL` | `https://broadcaster.battlecities.com` |
| Windows broadcaster | `BROADCASTER_CLIENT_URL` | `https://battlecities.com` |
| Windows broadcaster | `BROADCASTER_HOST` | `127.0.0.1` |
| Windows broadcaster | `BROADCASTER_PORT` | `7777` |
