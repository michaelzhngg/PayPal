#!/usr/bin/env bash
# Release manager for the Reclaim stack on the homeserver.
#
#   deploy.sh deploy sha-<40 hex>   pull, back up the DB, switch, verify; roll back on failure
#   deploy.sh rollback              switch back to the previous release
#   deploy.sh apply                 re-create containers on the current release (after editing .env)
#   deploy.sh status                show the live release and container health
#
# `deploy` optionally reads one stdin line "<registry user> <token>" to pull private
# GHCR images. The token is kept in a throwaway Docker config and deleted afterwards.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/reclaim}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300}"

cd "$APP_DIR"
umask 077

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

[[ -f .env ]] || die "$APP_DIR/.env is missing (run install.sh from your laptop first)"
grep -qE '^(POSTGRES_PASSWORD|SECRET_KEY)=(GENERATED)?$' .env && die ".env still has placeholder secrets"
touch release.env

exec 9>"$APP_DIR/.deploy.lock"
flock -n 9 || die "another deploy is already running"

compose() { docker compose --project-directory "$APP_DIR" --env-file .env --env-file release.env "$@"; }
env_value() { sed -n "s/^$1=//p" "$2" 2>/dev/null | tail -n1; }
http_port() { local p; p="$(env_value HTTP_PORT .env)"; echo "${p:-8080}"; }

current_tag()  { env_value IMAGE_TAG release.env; }
previous_tag() { env_value PREVIOUS_TAG release.env; }

record_release() {  # <live tag> <previous tag>
  printf 'IMAGE_TAG=%s\nPREVIOUS_TAG=%s\n' "$1" "$2" > release.env.tmp
  mv release.env.tmp release.env
}

registry_login() {
  local user token
  [[ -t 0 ]] && return 0
  IFS=' ' read -r -t 10 user token || true
  [[ -n "${user:-}" && -n "${token:-}" ]] || return 0
  DOCKER_CONFIG="$(mktemp -d)"
  export DOCKER_CONFIG
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
  printf '%s' "$token" | docker login ghcr.io -u "$user" --password-stdin >/dev/null
  log "logged in to ghcr.io as $user (temporary)"
}

backup_db() {
  [[ -n "$(compose ps -q --status running db 2>/dev/null)" ]] || { log "db not running yet, skipping backup"; return 0; }
  mkdir -p backups
  local file
  file="backups/$(date -u +%Y%m%dT%H%M%SZ)-${1:-initial}.dump"
  compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file"
  log "db backup: $file ($(du -h "$file" | cut -f1))"
  ls -1t backups/*.dump | tail -n +"$((BACKUP_KEEP + 1))" | xargs -r rm -f
}

smoke_test() {
  local base
  base="http://127.0.0.1:$(http_port)"
  curl -fsS -o /dev/null --max-time 15 --retry 5 --retry-delay 3 --retry-all-errors "$base/" \
    && curl -fsS -o /dev/null --max-time 15 --retry 5 --retry-delay 3 --retry-all-errors "$base/api/v1/openapi.json"
}

switch_to() {  # <tag>; returns non-zero if the stack is not healthy
  IMAGE_TAG="$1" compose up -d --pull missing --remove-orphans --wait --wait-timeout "$WAIT_TIMEOUT" && smoke_test
}

prune_images() {  # keep the live and previous release locally for instant rollback
  local registry keep_a="$1" keep_b="${2:-}"
  registry="$(env_value IMAGE_REGISTRY .env)"
  docker image ls --format '{{.Repository}}:{{.Tag}}' \
    | grep -E "^${registry}/(backend|frontend):" \
    | grep -vE ":(${keep_a}${keep_b:+|$keep_b})$" \
    | xargs -r docker image rm >/dev/null 2>&1 || true
  docker image prune -f >/dev/null
}

cmd_deploy() {
  local tag="${1:-}" prev
  [[ "$tag" =~ ^sha-[0-9a-f]{40}$ ]] || die "invalid image tag '$tag' (want sha-<40 hex>)"
  prev="$(current_tag)"
  log "deploying $tag (live: ${prev:-none})"

  registry_login
  IMAGE_TAG="$tag" compose pull --quiet || die "pull failed; nothing changed"

  if [[ "$tag" == "$prev" ]]; then
    switch_to "$tag" || die "re-deploy of the live release is unhealthy"
    log "re-deployed $tag"; return 0
  fi

  backup_db "${prev:-initial}"

  if switch_to "$tag"; then
    record_release "$tag" "$prev"
    echo "$(date -u +%FT%TZ) $tag ok" >> releases.log
    prune_images "$tag" "$prev"
    log "LIVE: $tag"
    return 0
  fi

  log "new release is unhealthy; recent logs:"
  IMAGE_TAG="$tag" compose ps || true
  IMAGE_TAG="$tag" compose logs --no-color --tail 80 backend frontend || true
  echo "$(date -u +%FT%TZ) $tag failed" >> releases.log

  if [[ -n "$prev" ]]; then
    log "rolling back to $prev"
    switch_to "$prev" || die "ROLLBACK FAILED, the site is down; check 'deploy.sh status'"
    log "rolled back to $prev. If $tag ran a DB migration, restore the newest file in backups/ (see the guide)"
  fi
  exit 1
}

cmd_rollback() {
  local live prev
  live="$(current_tag)"; prev="$(previous_tag)"
  [[ -n "$prev" ]] || die "no previous release recorded"
  log "rolling back $live -> $prev"
  switch_to "$prev" || die "previous release is unhealthy too"
  record_release "$prev" "$live"
  echo "$(date -u +%FT%TZ) $prev rollback" >> releases.log
  log "LIVE: $prev"
}

cmd_apply() {
  local live; live="$(current_tag)"
  [[ -n "$live" ]] || die "nothing deployed yet"
  switch_to "$live" || die "stack is unhealthy after apply"
  log "applied config to $live"
}

cmd_status() {
  local live; live="$(current_tag)"
  echo "live:     ${live:-none}"
  echo "previous: $(previous_tag)"
  # Placeholder tag so `ps` works before the first deploy; it only lists containers.
  IMAGE_TAG="${live:-none}" compose ps
  tail -n 5 releases.log 2>/dev/null || true
}

case "${1:-}" in
  deploy)   cmd_deploy "${2:-}" ;;
  rollback) cmd_rollback ;;
  apply)    cmd_apply ;;
  status)   cmd_status ;;
  *) echo "usage: $0 {deploy sha-<sha>|rollback|apply|status}" >&2; exit 2 ;;
esac
