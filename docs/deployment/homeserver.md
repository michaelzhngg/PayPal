# Deploying Reclaim to the homeserver

Production runs on Filbert's homeserver (`fil-laptop`, Ubuntu 26.04, reachable over
Tailscale as `ssh homelab`). The server holds **no source code**: GitHub Actions tests
the code, builds images, pushes them to GHCR, and the server only pulls images.

Steps are marked **[done]** (already set up) or **[you]** (needs a password, a
browser login, or an account owner).

## How it works

```
push to main
  ├─ Backend tests (pytest) ─┐
  └─ Frontend tsc + vitest ──┴─> Build images ─> push ghcr.io/michaelzhngg/paypal/{backend,frontend}:sha-<commit>
                                                    │
                                                    ▼
                         Deploy job joins the tailnet (tag:ci, OIDC, no stored Tailscale secret)
                         ssh homeserver "deploy sha-<commit>"   ← key can run nothing else
                                                    │
                                                    ▼  ~/reclaim/bin/deploy.sh on the server
              pull ─> pg_dump backup ─> compose up --wait (healthchecks) ─> smoke test via Caddy
                                                    │
                           healthy? ── yes ─> record as live, prune old images
                                     └ no ──> print logs, switch back to previous release, job fails
```

A failing test or build means nothing reaches the server. A release that does not
come up healthy is replaced automatically by the one that was running before.

On the server (`~/reclaim`):

| Path | What | Who changes it |
|---|---|---|
| `compose.yml`, `Caddyfile` | Stack definition (db, backend, frontend, caddy, optional cloudflared) | `install.sh` from your laptop |
| `.env` | Secrets and host settings, `chmod 600` | You, by hand |
| `release.env` | Live and previous image tag | `deploy.sh` |
| `bin/deploy.sh` | deploy / rollback / apply / status | `install.sh` |
| `bin/ssh-gate.sh` | Forced command for the CI key | `install.sh` |
| `backups/` | `pg_dump` before every deploy, last 14 kept | `deploy.sh` |

Traffic: `Internet ─> Tailscale Funnel or Cloudflare Tunnel ─> 127.0.0.1:8080 (Caddy) ─> frontend:3000 / backend:8000`.
Caddy sends `/api/v1/*` to FastAPI (PayPal callback, webhooks, settlement docs),
except the two progress streams that Next.js serves, and everything else to Next.js.
Nothing listens on a public interface, and no router port-forwarding is needed.

### Why it differs from a VPS

| VPS assumption | Homeserver reality | What we do |
|---|---|---|
| Public IP, open 80/443 | Home network, likely CGNAT, laptop on Wi-Fi | Outbound tunnels: Tailscale Funnel now, Cloudflare Tunnel later |
| Let's Encrypt on the box | No inbound 80/443 | TLS terminates at Funnel/Cloudflare; Caddy speaks plain HTTP on loopback |
| CI SSHes to a public IP | Server only on the tailnet | CI joins the tailnet as an ephemeral `tag:ci` node |
| Always on | It's a laptop | Lid switch already ignored; mask sleep targets (step 2) |
| ufw protects published ports | Docker bypasses ufw | Only `127.0.0.1:8080` is published |
| Repo checked out on server | You don't want source there | Server only pulls images; config is pushed by `install.sh` |

### Where secrets live

| Secret | Where | Why there |
|---|---|---|
| LLM / OpenRouter / PayPal / LangSmith keys, DB password, `SECRET_KEY`, Cloudflare tunnel token | Server `~/reclaim/.env` | Runtime secrets never pass through GitHub; anyone with repo write access can read Actions secrets by editing a workflow |
| `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER` | GitHub repo secrets | Needed by the deploy job. The key can only run `deploy <tag>`, `rollback`, `status` |
| `TS_OAUTH_CLIENT_ID`, `TS_AUDIENCE` | GitHub repo secrets | Tailscale federated identity (not secret values, kept with the rest) |
| `PUBLIC_URL` | GitHub repo **variable** | Post-deploy public smoke test and the Environment link |
| GHCR pull credential | Nowhere | The job's short-lived `GITHUB_TOKEN` is piped to the server for one pull, then deleted |

## Setup

### 1. Server files and CI key — [done]

- `deploy/homeserver/install.sh homelab <key.pub>` copied the stack to `~/reclaim`,
  generated `POSTGRES_PASSWORD` and `SECRET_KEY` into `~/reclaim/.env`, and authorized
  a dedicated ed25519 CI key as `command="…/ssh-gate.sh",restrict`. Verified: arbitrary
  commands, shell injection, bad tags and port forwarding are all refused.
- `PUBLIC_URL=https://fil-laptop.tail36f260.ts.net` set in `.env`.
- GitHub (`michaelzhngg/PayPal`): secrets `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`
  (host key pinned and fingerprint-checked against the server's own key),
  `DEPLOY_HOST=100.87.169.54`, `DEPLOY_USER=fil`; variable `PUBLIC_URL`.
  The private key exists only in GitHub; to rotate it, generate a new one and re-run step 1.

### 2. Let your user run Docker, keep the laptop awake — [you]

Needs your sudo password:

```bash
ssh homelab
sudo usermod -aG docker fil
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
exit
ssh homelab 'docker ps'          # new login, should list (no) containers without error
```

Being in the `docker` group is root-equivalent. That is why the CI key is
pinned to `ssh-gate.sh` rather than given a shell.

### 3. Fill in the app secrets — [you]

```bash
ssh homelab 'nano ~/reclaim/.env'
```

Set `LLM_API_KEY`, `OPENROUTER_API_KEY`, and optionally `LANGCHAIN_API_KEY`. Leave
`PAYPAL_MOCK_MODE=true` until step 7. Don't touch the generated
`POSTGRES_PASSWORD` after the first deploy (it's baked into the database volume).

### 4. Tailscale: tag, ACL, federated identity — [you]

In the [Tailscale admin console](https://login.tailscale.com/admin):

1. **Access controls**: add the tag and limit what CI can reach:

   ```jsonc
   "tagOwners": { "tag:ci": ["autogroup:admin"] },
   "grants": [
     // CI runners may only reach SSH on the homeserver.
     { "src": ["tag:ci"], "dst": ["100.87.169.54"], "ip": ["tcp:22"] }
   ],
   ```

   If your policy still has the default allow-all rule, `tag:ci` can reach every
   device. Tighten that when you're ready, keeping your own devices' access.
2. **Settings → Trust credentials → Credential → OpenID Connect**:
   - Issuer: **GitHub Actions**
   - Subject: `repo:michaelzhngg/PayPal:environment:production`
   - Scope: **auth_keys** (write), tag **tag:ci**
   - Generate, then copy **Client ID** and **Audience**.
3. Add them as repo secrets (gh works with your write access):

   ```bash
   gh secret set TS_OAUTH_CLIENT_ID -R michaelzhngg/PayPal   # paste Client ID
   gh secret set TS_AUDIENCE        -R michaelzhngg/PayPal   # paste Audience
   ```

### 5. Turn on Tailscale Funnel — [you]

```bash
ssh homelab
sudo tailscale funnel --bg 8080
tailscale funnel status
```

The first run prints a link if Funnel (and HTTPS certificates) aren't enabled for the
tailnet yet. Open it, approve, and re-run. `--bg` keeps it across reboots. The app is
then at **https://fil-laptop.tail36f260.ts.net**, once the first deploy has run.

### 6. Ship it — [you]

Merge the `ci/homeserver-deploy` branch (PR to `main`). The PR run tests and builds the
images without pushing. The merge to `main` runs the whole pipeline. Watch it under
**Actions → CI/CD**. The first deploy creates the GitHub Environment `production`
automatically.

Then seed the demo users once:

```bash
ssh homelab
cd ~/reclaim && docker compose --env-file .env --env-file release.env exec backend python -m seeds.create_demo_users
```

The first GHCR push creates private packages under `michaelzhngg`. That's fine:
deploys pull with the job's token.

### 7. PayPal sandbox — [you]

In the PayPal developer app set the return URL to
`<PUBLIC_URL>/api/v1/paypal/callback` and the webhook to `<PUBLIC_URL>/api/v1/paypal/webhook`.
Put `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID` in `.env`, set
`PAYPAL_MOCK_MODE=false`, then `ssh homelab '~/reclaim/bin/deploy.sh apply'`.

### 8. Later: Cloudflare Tunnel on reclaimai.dev — [you]

`reclaimai.dev` is active on Cloudflare with two placeholder records
(`reclaimai.dev` and `www`, both `AAAA 100::`, proxied, no rules use them).
**You don't need A records**: an A record would expose your home IP and need
port-forwarding. The tunnel creates a proxied CNAME instead.

1. **DNS → Records**: delete the `reclaimai.dev AAAA 100::` record. The tunnel needs that name.
   Keep `www`.
2. **Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared**, name it
   `reclaim-homeserver`. On the install screen pick **Docker**, copy only the token
   (the long string after `--token`). Don't run the command.
3. **Public hostname**: subdomain empty, domain `reclaimai.dev`, service **HTTP**,
   URL `caddy:80`. Save. Cloudflare creates the CNAME.
4. On the server, in `~/reclaim/.env`:

   ```bash
   COMPOSE_PROFILES=cloudflare
   CLOUDFLARE_TUNNEL_TOKEN=<token>
   PUBLIC_URL=https://reclaimai.dev
   ```

   then `ssh homelab '~/reclaim/bin/deploy.sh apply'`.
5. `gh variable set PUBLIC_URL -R michaelzhngg/PayPal -b https://reclaimai.dev`, and update
   the PayPal return/webhook URLs.
6. Optional: **Rules → Redirect from WWW to root** template.
7. Keep Funnel as a tailnet-only backdoor (`sudo tailscale funnel --bg off` then
   `sudo tailscale serve --bg 8080`) or turn it off (`sudo tailscale funnel reset`).

The frontend image uses relative URLs, so switching domains needs no rebuild.

## Day-2 operations

| Task | Command |
|---|---|
| What's live | `ssh homelab '~/reclaim/bin/deploy.sh status'` |
| Roll back to the previous release | `ssh homelab '~/reclaim/bin/deploy.sh rollback'` |
| Deploy any earlier build | Actions → CI/CD → Run workflow → `image_tag: sha-<commit>` |
| Apply `.env` edits | `ssh homelab '~/reclaim/bin/deploy.sh apply'` |
| Logs | `ssh homelab 'cd ~/reclaim && docker compose --env-file .env --env-file release.env logs -f backend'` |
| Changed `deploy/homeserver/*` | `deploy/homeserver/install.sh homelab` (CI cannot change these files on the server) |
| Restore a DB backup | `docker compose … exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/<file>.dump` |

**Migrations and rollback.** Migrations run when the backend starts. An automatic
rollback restores the old code, not the old schema. If a failed release had run a
migration, restore the backup taken just before it (newest file in `backups/`).

**Known limitation.** Login is rate-limited to 10/min per IP. All logins reach the
backend from the Next.js container, so every user shares that budget. This predates
this deployment, and it can bite during a busy demo.
