#!/usr/bin/env bash

set -Eeuo pipefail
umask 027

readonly APP_DIR="/opt/battlecities"
readonly APP_USER="battlecities"
readonly LOCK_FILE="/run/lock/battlecities-deploy.lock"

log() {
  printf '[battlecities-deploy] %s\n' "$*"
}

run_as_app() {
  runuser -u "$APP_USER" -- "$@"
}

wait_until_ready() {
  local attempt
  for attempt in $(seq 1 30); do
    if /usr/bin/curl --fail --silent --show-error \
      http://127.0.0.1:3001/api/ready >/dev/null; then
      return 0
    fi
    sleep 2
  done
  return 1
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log 'another deployment is already running'
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  log "deployment checkout is missing: $APP_DIR"
  exit 1
fi

if [[ -n "$(run_as_app /usr/bin/git -C "$APP_DIR" status --porcelain --untracked-files=no)" ]]; then
  log 'tracked deployment files have local changes; refusing to overwrite them'
  exit 1
fi

current_commit="$(run_as_app /usr/bin/git -C "$APP_DIR" rev-parse HEAD)"
run_as_app /usr/bin/git -C "$APP_DIR" fetch --prune origin master
target_commit="$(run_as_app /usr/bin/git -C "$APP_DIR" rev-parse origin/master)"

if [[ "$current_commit" == "$target_commit" ]]; then
  log "already current at ${current_commit:0:12}"
  wait_until_ready
  exit 0
fi

changed_files="$(
  run_as_app /usr/bin/git -C "$APP_DIR" diff \
    --name-only "$current_commit" "$target_commit"
)"

log "updating ${current_commit:0:12} -> ${target_commit:0:12}"
run_as_app /usr/bin/git -C "$APP_DIR" merge --ff-only "$target_commit"

if grep -Eq '^(package\.json|package-lock\.json)$' <<<"$changed_files" || \
  [[ ! -x "$APP_DIR/node_modules/.bin/tsc" ]]; then
  log 'installing root dependencies'
  run_as_app /usr/bin/npm --prefix "$APP_DIR" ci --no-audit --no-fund
fi

if grep -Eq '^api-server/(package\.json|package-lock\.json)$' <<<"$changed_files" || \
  [[ ! -x "$APP_DIR/api-server/node_modules/.bin/tsc" ]]; then
  log 'installing API dependencies'
  run_as_app /usr/bin/npm --prefix "$APP_DIR/api-server" ci --no-audit --no-fund
fi

log 'building API'
run_as_app /usr/bin/npm --prefix "$APP_DIR/api-server" run build

log 'applying database migrations'
/usr/bin/systemctl start battlecities-migrate.service

log 'restarting API service'
/usr/bin/systemctl restart battlecities-api.service

if ! wait_until_ready; then
  log 'readiness check failed'
  /usr/bin/journalctl -u battlecities-api.service -n 80 --no-pager
  exit 1
fi

log "deployment ${target_commit:0:12} is ready"
