#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key. authorized_keys pins that key to
# this script, so CI can deploy an image tag or roll back, and nothing else: no shell,
# no file uploads, no port forwarding. The stack definition (compose.yml, Caddyfile)
# only changes when you run install.sh yourself.
set -euo pipefail

read -r -a argv <<< "${SSH_ORIGINAL_COMMAND:-}"
deploy="$HOME/reclaim/bin/deploy.sh"

case "${argv[0]:-}:${#argv[@]}" in
  deploy:2)   exec "$deploy" deploy "${argv[1]}" ;;
  rollback:1) exec "$deploy" rollback </dev/null ;;
  status:1)   exec "$deploy" status </dev/null ;;
  *)
    echo "ssh-gate: command not allowed: '${SSH_ORIGINAL_COMMAND:-}'" >&2
    logger -t reclaim-ssh-gate "rejected: ${SSH_ORIGINAL_COMMAND:-<interactive>}" 2>/dev/null || true
    exit 126
    ;;
esac
