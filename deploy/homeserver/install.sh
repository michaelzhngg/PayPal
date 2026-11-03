#!/usr/bin/env bash
# Install or update the stack definition on the homeserver. Run from your laptop:
#
#   deploy/homeserver/install.sh [ssh-host] [ci-deploy-key.pub]
#
# Copies compose.yml, Caddyfile and the scripts to ~/reclaim, creates ~/reclaim/.env
# with generated secrets on first run (never overwrites it), and, if a public key is
# given, authorizes it for CI pinned to bin/ssh-gate.sh. Safe to re-run.
set -euo pipefail

HOST="${1:-homelab}"
PUBKEY_FILE="${2:-}"
SRC="$(cd "$(dirname "$0")" && pwd)"

ssh "$HOST" 'mkdir -p ~/reclaim/bin ~/reclaim/backups && chmod 700 ~/reclaim ~/reclaim/backups'
scp -q "$SRC/compose.yml" "$SRC/Caddyfile" "$SRC/.env.example" "$HOST:reclaim/"
scp -q "$SRC/bin/deploy.sh" "$SRC/bin/ssh-gate.sh" "$HOST:reclaim/bin/"

ssh "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
cd ~/reclaim
sed -i 's/\r$//' compose.yml Caddyfile .env.example bin/*.sh
chmod 700 bin/*.sh
if [[ ! -f .env ]]; then
  sed -e "s/^POSTGRES_PASSWORD=GENERATED$/POSTGRES_PASSWORD=$(openssl rand -hex 24)/" \
      -e "s/^SECRET_KEY=GENERATED$/SECRET_KEY=$(openssl rand -hex 32)/" \
      .env.example > .env
  chmod 600 .env
  echo "created ~/reclaim/.env with a generated DB password and SECRET_KEY; fill in the API keys"
fi
REMOTE

if [[ -n "$PUBKEY_FILE" ]]; then
  tr -d '\r' < "$PUBKEY_FILE" | ssh "$HOST" 'bash -c '"'"'
    set -euo pipefail
    read -r key
    [[ "$key" == ssh-* ]] || { echo "not an SSH public key" >&2; exit 1; }
    touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
    body="$(cut -d" " -f2 <<< "$key")"
    if grep -qF "$body" ~/.ssh/authorized_keys; then
      echo "CI deploy key already authorized"
    else
      printf "command=\"%s/reclaim/bin/ssh-gate.sh\",restrict %s\n" "$HOME" "$key" >> ~/.ssh/authorized_keys
      echo "authorized CI deploy key (forced command: ssh-gate.sh)"
    fi
  '"'"''
fi

echo "installed to $HOST:~/reclaim"
