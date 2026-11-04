# Homeserver setup checklist

Everything still needed to get Reclaim live on the homeserver, in order. Each step
says where to do it and how to check it worked. Background and day-2 operations are
in [homeserver.md](homeserver.md).

| # | Step | Status |
|---|---|---|
| 0 | Server files, CI deploy key, GitHub deploy secrets | ✅ done (Claude) |
| 1 | Add `fil` to the `docker` group | ✅ done (you) |
| 2 | Turn on Tailscale Funnel | ✅ done (you) |
| 3 | Stop the laptop from sleeping | ✅ done (you) |
| 4 | API keys in `~/reclaim/.env` (OpenRouter as main model) | ✅ done (you + Claude) |
| 5 | Tailscale policy: create `tag:ci`, limit what it can reach | ✅ done (you) |
| 6 | Tailscale trust credential for GitHub Actions + 2 GitHub secrets | ✅ done (you) |
| 7 | Merge the deploy branch → first deploy | ✅ live (sha-67049f0) |
| 8 | Seed demo users, check the site | ✅ done (you) |
| 9 | PayPal sandbox (after step 10) | ⬜ |
| 10 | Cloudflare Tunnel on reclaimai.dev | ✅ live (www redirect pending) |

---

## Where secrets live, and why

| Secret | Lives in | Why |
|---|---|---|
| `OPENROUTER_API_KEY` (also used as `LLM_API_KEY`), `LANGCHAIN_API_KEY`, `PAYPAL_CLIENT_SECRET`, DB password, `SECRET_KEY`, Cloudflare tunnel token | Server: `~/reclaim/.env` | The app reads them at runtime on the server. Anyone with write access to the repo can read GitHub secrets by pushing a workflow that prints them, so these never go to GitHub. |
| `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER` | GitHub repo secrets (already set) | Leaking them is harmless: the key can only run `deploy <tag>`, `rollback`, `status`. |
| `TS_OAUTH_CLIENT_ID`, `TS_AUDIENCE` | GitHub repo secrets (step 6) | Identify the Tailscale credential. They are not passwords; GitHub's signed OIDC token is the proof. |
| `PUBLIC_URL` | GitHub repo variable (already set) | Not secret; used for the post-deploy check. |

Rule of thumb: if the app needs it, it goes in `~/reclaim/.env`. If only the pipeline
needs it, it goes in GitHub.

---

## Step 3: Stop the laptop from sleeping

Lid-close is already ignored, but the system can still suspend when idle.

```bash
ssh homelab
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

**Check:** `systemctl is-enabled suspend.target` prints `masked`.

Also keep it on the charger (the battery was at 72%).

---

## Step 4: Fill in the API keys ✅

Done. `~/reclaim/.env` has `OPENROUTER_API_KEY` and `LANGCHAIN_API_KEY`. ILMU is
skipped: the main chat model runs on OpenRouter too.

| Model | Setting in `.env` | Value |
|---|---|---|
| Chat (policy, compliance, agent) | `LLM_BASE_URL`, `LLM_API_KEY`, `CHAT_MODEL` | `https://openrouter.ai/api/v1`, `${OPENROUTER_API_KEY}` (refers to the key, not a copy), `google/gemini-3.8-flash` |
| Chat fallback | hard-coded in `backend/engine/llm.py` | OpenRouter `google/gemini-3.1-flash-lite-preview` |
| Receipt vision | `VISION_MODEL` | OpenRouter `qwen/qwen3.5-flash-02-23` |
| Embeddings | `EMBEDDING_MODEL` | OpenRouter `openai/text-embedding-3-small` |

`LLM_API_KEY=${OPENROUTER_API_KEY}` must stay **below** the `OPENROUTER_API_KEY` line.

### Later: Gemini API as the main model

1. Get a key at https://aistudio.google.com/apikey.
2. `ssh homelab 'nano ~/reclaim/.env'` and change the three chat lines to:
   ```bash
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
   LLM_API_KEY=<your Gemini key>
   CHAT_MODEL=<model id from AI Studio, e.g. gemini-…-flash, no "google/" prefix>
   ```
3. Apply: `ssh homelab '~/reclaim/bin/deploy.sh apply'`.

Vision, embeddings and the fallback keep using OpenRouter, so keep that key.

Don't change:
- `POSTGRES_PASSWORD`: after the first deploy it's stored in the database volume, and
  changing it breaks the connection.
- `SECRET_KEY`: changing it logs everyone out.
- `PAYPAL_MOCK_MODE=true`: leave it until step 9.
- `PUBLIC_URL=https://fil-laptop.tail36f260.ts.net`: already set for Funnel.

---

## Step 5: Tailscale policy, create `tag:ci`

The pipeline joins your tailnet as a temporary device tagged `tag:ci`. The tag must
exist before step 6, and it should only be able to SSH to the homeserver.

1. Open https://login.tailscale.com/admin/acls/file (**Access controls** → editor).
2. **Before editing, copy the whole file into a text file as a backup.**
3. Look at what you have. Typically one of these:

   **A. New-style default (`grants`):**
   ```jsonc
   "grants": [
     { "src": ["*"], "dst": ["*"], "ip": ["*"] },
   ],
   ```
   **B. Old-style default (`acls`):**
   ```jsonc
   "acls": [
     { "action": "accept", "src": ["*"], "dst": ["*:*"] },
   ],
   ```

   Both mean "every device can reach every device". With that rule, the CI runner could
   reach all your devices, which is what we want to prevent.

4. Make these edits. Keep everything else (`ssh`, `nodeAttrs` with `funnel`, `tests`, …):

   - **Add** (or extend) `tagOwners`:
     ```jsonc
     "tagOwners": {
       "tag:ci": ["autogroup:admin"],
     },
     ```
   - **Add** a `hosts` entry so the rule is readable:
     ```jsonc
     "hosts": {
       "homeserver": "100.87.169.54",
     },
     ```
   - **Replace** the allow-all rule:

     If you have **A (`grants`)**, replace the `*` rule with:
     ```jsonc
     "grants": [
       // My own devices: full access to everything (same as before for me).
       { "src": ["autogroup:member"], "dst": ["*"], "ip": ["*"] },
       // GitHub Actions runners: SSH to the homeserver, nothing else.
       { "src": ["tag:ci"], "dst": ["homeserver"], "ip": ["tcp:22"] },
     ],
     ```

     If you have **B (`acls`)**, replace the `*` rule with:
     ```jsonc
     "acls": [
       // My own devices: full access to everything (same as before for me).
       { "action": "accept", "src": ["autogroup:member"], "dst": ["*:*"] },
       // GitHub Actions runners: SSH to the homeserver, nothing else.
       { "action": "accept", "src": ["tag:ci"], "dst": ["homeserver:22"] },
     ],
     ```

   > `autogroup:member` means devices logged in as a person (your laptop, phone,
   > homeserver). If you have **tagged** servers (check the Machines page for a tag
   > badge, e.g. maybe `floodready-api`) that need to reach other devices, add a rule
   > for their tag too, or they lose access.

5. Click **Save**. The editor refuses to save if the JSON is invalid, so nothing
   breaks silently.

**Check:**
- From your Windows laptop: `ssh homelab hostname` still works.
- Funnel still works: `ssh homelab tailscale funnel status` shows `Funnel on`.
- In the policy file, the `nodeAttrs` block with `"funnel"` is still there.

---

## Step 6: Trust credential for GitHub Actions

Instead of storing a Tailscale secret in GitHub, Tailscale trusts GitHub's signed
identity token for **this repo's production deploy job only**.

1. Open https://login.tailscale.com/admin/settings/trust-credentials
   (**Settings** → **Trust credentials**) → **Credential** → **OpenID Connect**.
2. First page:

   | Field | Value |
   |---|---|
   | Description | `Paypal Hackathon` (anything) |
   | Issuer | **GitHub** |
   | Issuer URL | `https://token.actions.githubusercontent.com` (filled in for you) |
   | Subject | `repo:michaelzhngg@142100201/PayPal@1443110379:environment:production` |
   | Custom claims | none (don't click *Add claim key*) |

   This repo uses GitHub's *immutable subject* format (owner and repo IDs after the
   `@`), so the plain `repo:michaelzhngg/PayPal:…` form is rejected with a 403. Check the
   current prefix with `gh api repos/michaelzhngg/PayPal/actions/oidc/customization/sub`.

   Type the subject exactly, case included. The placeholder `…:environment:*` would
   allow any environment; we pin it to `production`, the one the deploy job uses.
   Runs from PRs or forks get a different subject and are refused.

   Click **Continue**.
3. Scopes page: enable **Auth Keys** with **Write**. When asked for tags, pick
   **`tag:ci`**. Leave every other scope off.

   If `tag:ci` isn't in the list, step 5 wasn't saved.
4. **Generate credential**. Copy **Client ID** and **Audience** (they're shown again in
   the console later; they aren't passwords).
5. Store them in the repo, from your laptop (you have the rights; I checked):

   ```powershell
   gh secret set TS_OAUTH_CLIENT_ID -R michaelzhngg/PayPal
   # paste the Client ID, Enter
   gh secret set TS_AUDIENCE -R michaelzhngg/PayPal
   # paste the Audience, Enter
   ```

**Check:** `gh secret list -R michaelzhngg/PayPal` shows six secrets:
`DEPLOY_HOST`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_SSH_KEY`, `DEPLOY_USER`,
`TS_AUDIENCE`, `TS_OAUTH_CLIENT_ID`.

---

## Step 7: Merge the deploy branch → first deploy

The work is on the local branch `ci/homeserver-deploy` (Claude can push it and open
the PR for you; just say so).

```powershell
git push -u origin ci/homeserver-deploy
gh pr create -R michaelzhngg/PayPal --base main --head ci/homeserver-deploy --fill
```

1. The PR runs **Backend tests**, **Frontend typecheck + tests**, and builds both
   images (without pushing, without deploying). Wait for green.
2. Merge the PR. The push to `main` runs the full pipeline, including **Deploy to
   homeserver**.
3. Watch it: `gh run watch -R michaelzhngg/PayPal`, or the repo's **Actions** tab →
   **CI/CD**.

The first deploy takes longer (pulls Postgres, Caddy, both images; creates the
database). Expect 5–10 minutes.

**Check:**
- Last step **Public smoke test** is green, and the run summary says
  `Live: https://fil-laptop.tail36f260.ts.net`.
- `ssh homelab '~/reclaim/bin/deploy.sh status'` shows `live: sha-…` and all
  containers `healthy`.
- https://fil-laptop.tail36f260.ts.net opens the landing page.

**If it fails**, open the failed step's log:

| Fails at | Likely cause | Fix |
|---|---|---|
| Join tailnet | Subject or tag mismatch in step 6, or secrets missing | Re-check step 6 values; subject must be exactly `repo:michaelzhngg@142100201/PayPal@1443110379:environment:production` |
| Wait for the server to be reachable | Policy doesn't allow `tag:ci` → `100.87.169.54:22` | Re-check step 5 |
| Deploy: `.env still has placeholder secrets` | `.env` was recreated | Re-run `install.sh` or fix `.env` |
| Deploy: `pull failed` | Image not pushed / GHCR permission | Check the **Build** jobs ran on `main` and pushed |
| Deploy: unhealthy, rolled back | App fails to start | The step prints backend/frontend logs; usually a missing/wrong key in `.env` |
| Public smoke test | Funnel off | `ssh homelab tailscale funnel status`; re-run `sudo tailscale funnel --bg 8080` |

After fixing, re-run the failed job from the Actions page (**Re-run failed jobs**).

---

## Step 8: Seed demo users, check the site

Once, after the first successful deploy:

```bash
ssh homelab
cd ~/reclaim
docker compose --env-file .env --env-file release.env exec backend python -m seeds.create_demo_users
```

**Check:** log in at https://fil-laptop.tail36f260.ts.net/login with a demo account
(`employee@example.com` / `hr@example.com`, password `password`). Submit a receipt.
Analysis needs the API keys from step 4.

---

## Step 9: PayPal sandbox (when ready)

1. https://developer.paypal.com → **Apps & Credentials** (Sandbox) → your app.
2. **Log in with PayPal** → Return URL:
   `https://fil-laptop.tail36f260.ts.net/api/v1/paypal/callback`
3. **Webhooks** → Add webhook → URL:
   `https://fil-laptop.tail36f260.ts.net/api/v1/paypal/webhook`, events: all
   `PAYMENT.PAYOUTS-ITEM.*`. Copy the **Webhook ID**.
4. On the server, edit `~/reclaim/.env`:
   ```bash
   PAYPAL_MOCK_MODE=false
   PAYPAL_CLIENT_ID=<sandbox client id>
   PAYPAL_CLIENT_SECRET=<sandbox secret>
   PAYPAL_WEBHOOK_ID=<webhook id>
   ```
5. Apply: `ssh homelab '~/reclaim/bin/deploy.sh apply'`

**Check:** Employee → Settings → Connect PayPal goes to the sandbox login and comes
back to `/employee/settings?paypal=…`.

---

## Step 10: Cloudflare Tunnel on reclaimai.dev

Do this **before** step 9 (PayPal), so the PayPal URLs are registered once, on the
final domain.

`reclaimai.dev` is active on Cloudflare (DNS setup: Full) with two placeholder
records, `reclaimai.dev AAAA 100::` and `www.reclaimai.dev AAAA 100::`. Both are
proxied, and no rules use them.

**You don't add A records.** An A record would point at your home IP and need
port-forwarding. A tunnel is an outbound connection from the server, and Cloudflare
creates a proxied CNAME to it.

### 10.1 Remove the apex placeholder

1. https://dash.cloudflare.com → **reclaimai.dev** → **DNS** → **Records**.
2. Row `reclaimai.dev` / `AAAA` / `100::` → **Edit** → **Delete** → confirm.
3. Keep `www.reclaimai.dev` (used for the www → root redirect in 10.6).

### 10.2 Create the tunnel

1. Go back to the account (top-left account name), then in the sidebar:
   **Networking** → **Tunnels**. (Older layout: **Zero Trust** → **Networks** →
   **Tunnels**. If asked to pick a Zero Trust plan, choose **Free**.)
2. **Create a tunnel** → type **Cloudflared** → name `reclaim-homeserver` → **Save**.
3. On **Install and run connectors**, choose **Docker**. The command looks like
   `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoi…`.
   Copy **only the token** (the long `eyJ…` string). **Don't run the command**: the
   stack already includes cloudflared.
4. **Next**.

### 10.3 Route the domain to the app

Open the tunnel → **Routes** tab → **Add route** → **Published application**:

| Field | Value |
|---|---|
| Subdomain | (empty) |
| Domain | `reclaimai.dev` |
| Path | (empty) |
| Service URL | `http://caddy:80` |

Leave **Additional application settings** as they are, then **Add route**. Cloudflare
creates the proxied `reclaimai.dev` CNAME to the tunnel. If it says a record already
exists, 10.1 wasn't done.

`caddy` is the Caddy container's name on the app's Docker network. This only resolves
from the stack's own cloudflared (10.4), **not** from a connector started with the
`docker run` command Cloudflare shows. That one sits on Docker's default network and
gets a 502.

### 10.4 Start the connector on the server

```bash
ssh homelab
nano ~/reclaim/.env
```

Change `PUBLIC_URL`, and uncomment and fill the two Cloudflare lines (remove the `# `):

```bash
PUBLIC_URL=https://reclaimai.dev
COMPOSE_PROFILES=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

Then apply:

```bash
~/reclaim/bin/deploy.sh apply
```

This starts `cloudflared` next to the rest and restarts the backend with the new URL.

On your laptop, point the pipeline's public check at the domain:

```powershell
gh variable set PUBLIC_URL -R michaelzhngg/PayPal -b https://reclaimai.dev
```

**Check:**
- `ssh homelab '~/reclaim/bin/deploy.sh status'` lists `reclaim-cloudflared-1` as Up.
- Cloudflare → Networking → Tunnels shows `reclaim-homeserver` as **Healthy**.
- https://reclaimai.dev opens the landing page, and
  https://reclaimai.dev/api/v1/openapi.json returns JSON.

If the tunnel stays down: `ssh homelab 'docker logs reclaim-cloudflared-1 --tail 30'`.
`Unauthorized` / `invalid token` means the token was copied wrong (often cut short).

### 10.5 Don't let Cloudflare block PayPal

PayPal's webhook calls are automated requests, and Cloudflare's bot protection can
challenge them, which drops them without any error you'd see.

- reclaimai.dev → **Security** → **Settings** (or **Bots**): make sure **Bot Fight
  Mode** is **off**. It can't be bypassed per path on the free plan.
- If you turn on other WAF or bot rules later, add a rule that **skips** them for
  URI path `/api/v1/paypal/webhook`.

### 10.6 Optional extras

- **www → root:** keep `www` as a proxied CNAME to `reclaimai.dev` (no tunnel route for
  it), then reclaimai.dev → **Rules** → **Overview** → template **Redirect from WWW to
  root** → **Create from template** → Deploy. Without the rule, `www` returns a 404 from
  the tunnel.
- **SSL/TLS** → **Edge Certificates**: turn on **Always Use HTTPS**.
- **Funnel afterwards:** keep it as a backup URL (no action), or make it tailnet-only
  with `sudo tailscale funnel reset && sudo tailscale serve --bg 8080`.

No rebuild is needed for the domain switch. The frontend uses relative URLs.

Now do step 9 with `https://reclaimai.dev` in place of the Funnel URL.

---

## Done: what "live" looks like

- Every merge to `main`: tests → images → deploy → health check → live, or an
  automatic rollback and a red run.
- `ssh homelab '~/reclaim/bin/deploy.sh status'` shows the live release.
- Rollback any time: `ssh homelab '~/reclaim/bin/deploy.sh rollback'`, or Actions →
  CI/CD → **Run workflow** with `image_tag: sha-<commit>`.
