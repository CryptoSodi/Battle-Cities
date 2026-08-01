# BattleCities native Ubuntu deployment

This deployment is designed for a small 1 vCPU / 1 GB RAM Ubuntu server. It
runs PostgreSQL and Caddy as native system services and runs the API plus the
authoritative WebRTC broadcaster inside one Node process.

Only one BattleCities command is started:

```text
api.battlecities.com -> Caddy -> 127.0.0.1:3001
                                    |
                                    +-- API routes
                                    +-- matchmaking
                                    +-- WebRTC broadcaster and match simulation
```

There is no `broadcaster.battlecities.com`, port `7777`, Docker, or Vercel Blob
configuration. Authoritative match archives are stored in PostgreSQL.

Caddy rejects public `/matches` and `/past-matches` control requests. The API
reaches those routes directly over `127.0.0.1:3001`, protected by an
automatically generated in-memory token.

## 1. Server and DNS

Point only `api.battlecities.com` at the Ubuntu server. Allow inbound TCP 22,
80, and 443. PostgreSQL must not be exposed publicly.

For Cloudflare, proxy `api.battlecities.com` and use SSL/TLS mode **Full
(strict)**. Remove the old broadcaster tunnel/DNS record after cutover.

One gigabyte is tight. Add 2 GB of emergency swap before starting matches:

```bash
swapon --show
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Do not create a second swap file if `swapon --show` already lists one.

## 2. Install native services

Install Node.js 22 LTS, then verify that `node` and `npm` are available under
`/usr/bin`. Install PostgreSQL, Caddy, and Git from the Ubuntu packages:

```bash
node --version
npm --version
sudo apt update
sudo apt install -y git postgresql postgresql-client caddy
```

Create a locked service account and install the repository:

```bash
sudo useradd --system --create-home \
  --home-dir /var/lib/battlecities \
  --shell /usr/sbin/nologin battlecities
sudo git clone https://github.com/CryptoSodi/Battle-Cities.git /opt/battlecities
sudo chown -R battlecities:battlecities /opt/battlecities
sudo -u battlecities npm --prefix /opt/battlecities ci
sudo -u battlecities npm --prefix /opt/battlecities/api-server ci
sudo -u battlecities npm --prefix /opt/battlecities run server:build
```

If the account already exists, skip `useradd`. If Node is installed somewhere
other than `/usr/bin/node`, update `ExecStart` in the service file.

## 3. Configure PostgreSQL

Generate two different alphanumeric passwords without adding them to shell
history:

```bash
read -rsp 'Database owner password: ' DB_OWNER_PASSWORD; echo
read -rsp 'Database app password: ' DB_APP_PASSWORD; echo
```

Create the database owner and the least-privilege account used by the API:

```bash
sudo -u postgres psql \
  --set=database_name=battlecities \
  --set=owner_user=battlecities_owner \
  --set=owner_password="$DB_OWNER_PASSWORD" \
  --set=app_user=battlecities_app \
  --set=app_password="$DB_APP_PASSWORD" \
  --file=/opt/battlecities/deploy/ubuntu/postgres/setup-database.sql
```

Keep those two variables until the environment files are configured. Tune
PostgreSQL for the small machine by locating its configuration:

```bash
sudo -u postgres psql -tAc 'SHOW config_file'
```

Open that file with `sudoedit` and set:

```conf
listen_addresses = '127.0.0.1'
max_connections = 20
shared_buffers = 64MB
effective_cache_size = 256MB
maintenance_work_mem = 32MB
work_mem = 1MB
```

Then restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

## 4. Configure the combined API

```bash
sudo install -d -m 750 -o root -g battlecities /etc/battlecities
sudo cp /opt/battlecities/deploy/ubuntu/.env.example \
  /etc/battlecities/api.env
sudo cp /opt/battlecities/deploy/ubuntu/.migration.env.example \
  /etc/battlecities/migrate.env
sudo chown root:battlecities /etc/battlecities/api.env
sudo chmod 640 /etc/battlecities/api.env
sudo chown root:root /etc/battlecities/migrate.env
sudo chmod 600 /etc/battlecities/migrate.env
sudoedit /etc/battlecities/api.env
sudoedit /etc/battlecities/migrate.env
```

Put `DB_APP_PASSWORD` in `api.env` and `DB_OWNER_PASSWORD` in `migrate.env`.
Generate independent OAuth/admin state secrets with `openssl rand -hex 32`.
The embedded broadcaster authorization token is generated automatically in
memory at startup. Copy Google and Discord credentials from the old API
deployment.

The important combined-runtime values are:

```env
BATTLECITY_EMBED_BROADCASTER=1
BROADCASTER_BASE_URL=http://127.0.0.1:3001
BROADCASTER_API_URL=http://127.0.0.1:3001
BROADCASTER_PUBLIC_URL=https://api.battlecities.com
```

Keep these OAuth callbacks configured:

- Google: `https://api.battlecities.com/api/auth/google/callback`
- Discord: `https://api.battlecities.com/api/integrations/discord/oauth/callback`

Clear the temporary shell variables:

```bash
unset DB_OWNER_PASSWORD DB_APP_PASSWORD
```

## 5A. New empty database

Install and run the migration unit:

```bash
sudo cp /opt/battlecities/deploy/ubuntu/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start battlecities-migrate.service
sudo systemctl status battlecities-migrate.service --no-pager
```

Continue to section 6.

## 5B. Move the existing Neon database

Use this instead of 5A to preserve production accounts, purchases, events,
matches, Discord links, and authoritative match archives.

Install a `pg_dump` client with the same or newer major version as Neon. Read
the Neon URL without adding it to shell history:

```bash
read -rsp 'Old Neon DATABASE_URL: ' OLD_DATABASE_URL; echo
mkdir -p "$HOME/battlecities-backup"
pg_dump "$OLD_DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  --file="$HOME/battlecities-backup/neon.dump"
unset OLD_DATABASE_URL
```

Read the local owner URL from `migrate.env` manually and restore only into the
new BattleCities database. `--clean` replaces objects in that target database:

```bash
read -rsp 'Local owner DATABASE_URL: ' LOCAL_OWNER_URL; echo
pg_restore --dbname="$LOCAL_OWNER_URL" \
  --clean --if-exists --no-owner --no-acl \
  "$HOME/battlecities-backup/neon.dump"
psql "$LOCAL_OWNER_URL" \
  --set=app_user=battlecities_app \
  --file=/opt/battlecities/deploy/ubuntu/postgres/grant-app-user.sql
unset LOCAL_OWNER_URL
sudo systemctl start battlecities-migrate.service
```

## 6. Enable HTTPS and start the one application service

```bash
sudo cp /opt/battlecities/deploy/ubuntu/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl enable battlecities-api.service caddy postgresql
sudo systemctl start battlecities-api.service
```

There is no broadcaster service to start.

## 7. Verify

```bash
systemctl status battlecities-api postgresql caddy --no-pager
curl --fail https://api.battlecities.com/api/health
curl --fail https://api.battlecities.com/api/ready
curl --fail https://api.battlecities.com/health
```

`/api/health` checks the API. `/health` checks the embedded authoritative
broadcaster. Opening `https://api.battlecities.com/` displays its monitor.

Follow runtime logs and memory usage:

```bash
journalctl -u battlecities-api -f
free -h
ps -o pid,%cpu,%mem,rss,cmd -C node -C postgres -C caddy
```

Test Google login, Discord verification, player/shop writes, two-player
matchmaking, reconnect, authoritative scoring, and archive playback before
removing the old deployment.

## Updates

```bash
sudo systemctl stop battlecities-api
sudo -u battlecities git -C /opt/battlecities pull --ff-only
sudo -u battlecities npm --prefix /opt/battlecities ci
sudo -u battlecities npm --prefix /opt/battlecities/api-server ci
sudo -u battlecities npm --prefix /opt/battlecities run server:build
sudo systemctl start battlecities-migrate.service
sudo systemctl start battlecities-api
```

## Database backups

Store backups off the server as well:

```bash
read -rsp 'Local owner DATABASE_URL: ' LOCAL_OWNER_URL; echo
mkdir -p "$HOME/battlecities-backup"
pg_dump "$LOCAL_OWNER_URL" --format=custom --no-owner --no-acl \
  --file="$HOME/battlecities-backup/battlecities-$(date +%F-%H%M).dump"
unset LOCAL_OWNER_URL
```
