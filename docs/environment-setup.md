# Deployment environment setup

BattleCities has two public deployments:

| Deployment | Responsibility |
| --- | --- |
| Cloudflare Pages game client | Static game UI and browser assets |
| Native Ubuntu backend | API, authoritative broadcaster, PostgreSQL, and HTTPS |

The backend exposes everything through `https://api.battlecities.com`. There is
no separate broadcaster hostname or process.

## Game client

Configure only:

```env
BATTLECITY_API_BASE_URL=https://api.battlecities.com
```

Never put database, Google, Discord, broadcaster, or admin secrets in the game
client project.

## Native backend

Use `/etc/battlecities/api.env`, based on
[`deploy/ubuntu/.env.example`](../deploy/ubuntu/.env.example). The embedded
runtime requires:

```env
BATTLECITY_EMBED_BROADCASTER=1
BROADCASTER_BASE_URL=http://127.0.0.1:3001
BROADCASTER_API_URL=http://127.0.0.1:3001
BROADCASTER_PUBLIC_URL=https://api.battlecities.com
BROADCASTER_CLIENT_URL=https://play.battlecities.com
```

The process generates an ephemeral broadcaster token automatically at startup.
It still protects service-control routes against public callers, but operators
do not need to configure or copy it.

Use a PostgreSQL application URL in `api.env` and keep the database-owner URL
in the root-readable `/etc/battlecities/migrate.env` only.

## Build and start

```bash
npm ci
npm --prefix api-server ci
npm run server:build
npm run server:start
```

For production `systemd`, PostgreSQL, Caddy, memory tuning, Neon migration, and
backup instructions, follow
[`deploy/ubuntu/README.md`](../deploy/ubuntu/README.md).

## Public checks

```text
https://api.battlecities.com/api/health  API health
https://api.battlecities.com/api/ready   PostgreSQL readiness
https://api.battlecities.com/health      Embedded broadcaster health
https://api.battlecities.com/            Broadcaster monitor
```
