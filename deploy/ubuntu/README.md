# BattleCities Ubuntu deployment

This stack runs the BattleCities API, headless broadcaster, PostgreSQL, and
Caddy on one Ubuntu server. The API and broadcaster use the same application
image but remain separate processes so either service can restart without
interrupting the other.

The game UI may remain on Vercel. It calls `https://api.battlecities.com`; the
API calls the broadcaster over the private Docker network.

## Services

| Service | Public address | Internal address |
| --- | --- | --- |
| API | `https://api.battlecities.com` | `http://api:3001` |
| Broadcaster | `https://broadcaster.battlecities.com` | `http://broadcaster:7777` |
| PostgreSQL | Not public | `postgres:5432` |
| Caddy | TCP 80/443 and UDP 443 | Reverse proxy and automatic TLS |

Authoritative match archives are stored in PostgreSQL. The legacy Vercel Blob
replay path is not used or configured by this deployment.

## 1. Prepare the server

Ubuntu 24.04 with at least 4 vCPU, 8 GB RAM, and SSD storage is recommended for
running authoritative matches and WebRTC peers on the same machine.

Point these DNS records at the Ubuntu server:

- `api.battlecities.com`
- `broadcaster.battlecities.com`

Allow inbound TCP 22, 80, and 443. Allow UDP 443 for HTTP/3. Do not expose
PostgreSQL port 5432.

The stack creates a database owner used only by migrations and a separate
least-privilege login used by the running API.

Install Docker and Git:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Sign out and back in after adding the Docker group.

## 2. Configure BattleCities

```bash
git clone https://github.com/CryptoSodi/Battle-Cities.git
cd Battle-Cities
cp deploy/ubuntu/.env.example deploy/ubuntu/.env
chmod 600 deploy/ubuntu/.env
nano deploy/ubuntu/.env
```

Generate independent secrets, for example:

```bash
openssl rand -hex 32
```

Set a different generated value for each secret, including the PostgreSQL owner
and application passwords. Keep PostgreSQL passwords alphanumeric because they
are embedded in internal connection URLs. Copy the Google and Discord
credentials from the old API deployment; do not copy
`BATTLECITY_API_BASE_URL` because that belongs only to the game UI.

Validate the resolved configuration before starting containers:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml config --quiet
```

Keep these public OAuth callback URLs configured at their providers:

- Google: `https://api.battlecities.com/api/auth/google/callback`
- Discord: `https://api.battlecities.com/api/integrations/discord/oauth/callback`

If Cloudflare proxies the two DNS records, use SSL/TLS mode **Full (strict)**.
Caddy still owns the origin certificate and HTTPS connection.

## 3A. Start with a new database

From the repository root:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml up -d --build
```

The `migrate` service waits for PostgreSQL and applies all migrations before the
API starts. It is safe to run the command again after future deployments.

## 3B. Move the existing Neon database

Use this path instead of 3A when preserving production players, purchases,
matches, events, Discord links, and match archives.

First start only the new PostgreSQL container:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml up -d postgres
mkdir -p deploy/ubuntu/backups
```

Read the old Neon connection string without placing it in shell history, then
create a custom-format backup:

```bash
read -rsp "Old Neon DATABASE_URL: " OLD_DATABASE_URL; echo
docker run --rm \
  -e OLD_DATABASE_URL="$OLD_DATABASE_URL" \
  -v "$PWD/deploy/ubuntu/backups:/backup" \
  postgres:17-alpine \
  sh -c 'pg_dump "$OLD_DATABASE_URL" --format=custom --no-owner --no-acl --file=/backup/neon.dump'
unset OLD_DATABASE_URL
```

Restore only into the fresh BattleCities PostgreSQL database. The following
command replaces objects in that target database:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml exec -T postgres \
  pg_restore --username battlecities_owner --dbname battlecities \
  --clean --if-exists --no-owner --no-acl \
  < deploy/ubuntu/backups/neon.dump
```

If `POSTGRES_USER` or `POSTGRES_DB` was changed in `.env`, use the same values in
the restore command. Restore the application user's grants over all imported
objects (also substitute the user/database values if changed):

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml exec -T postgres \
  psql --username battlecities_owner --dbname battlecities \
  --set=app_user=battlecities_app \
  < deploy/ubuntu/postgres/grant-app-user.sql
```

Use a PostgreSQL dump image with the same or newer major version than the source
Neon database.

Now build the application and apply any migrations added after the backup:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml up -d --build
```

## 4. Verify the deployment

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml ps
curl --fail https://api.battlecities.com/api/health
curl --fail https://api.battlecities.com/api/ready
curl --fail https://broadcaster.battlecities.com/health
```

Follow logs without printing environment secrets:

```bash
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml logs -f api broadcaster postgres caddy
```

Then test Google login, Discord verification, player/shop data, two-player
matchmaking, WebRTC reconnect, authoritative scores, and match archives.

## Updates

```bash
git pull --ff-only
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml up -d --build
```

Compose starts a one-shot migration container before replacing the healthy API.

## PostgreSQL backup

Create backups regularly and copy them off this server:

```bash
mkdir -p deploy/ubuntu/backups
docker compose --env-file deploy/ubuntu/.env \
  -f deploy/ubuntu/compose.yaml exec -T postgres \
  pg_dump --username battlecities_owner --dbname battlecities \
  --format=custom --no-owner --no-acl \
  > "deploy/ubuntu/backups/battlecities-$(date +%F-%H%M).dump"
```

## Safe production cutover

1. Bring up and test this stack before changing production DNS.
2. Put writes into a short maintenance window.
3. Take and restore one final Neon backup.
4. Point the API and broadcaster DNS records to Ubuntu.
5. Test login, database reads/writes, Discord, and a complete multiplayer match.
6. Keep Neon and the old deployment available briefly as rollback targets.
7. After the rollback window, rotate secrets stored in the old Vercel projects.
