# Homeserver setup checklist

Everything still needed to get Reclaim live on the homeserver, in order. Each step
says where to do it and how to check it worked. Background and day-2 operations are
in [homeserver.md](homeserver.md).

| # | Step | Status |
|---|---|---|
| 0 | Server files, CI deploy key, GitHub deploy secrets | ✅ done (Claude) |
| 1 | Add `fil` to the `docker` group | ✅ done (you) |
| 2 | Turn on Tailscale Funnel | ✅ done (you) |
| 3 | Stop the laptop from sleeping | ⬜ |
| 4 | Fill in the API keys in `~/reclaim/.env` | ⬜ |
| 5 | Tailscale policy: create `tag:ci`, limit what it can reach | ⬜ |
| 6 | Tailscale trust credential for GitHub Actions + 2 GitHub secrets | ⬜ |
| 7 | Merge the deploy branch → first deploy | ⬜ |
| 8 | Seed demo users, check the site | ⬜ |
| 9 | PayPal sandbox (optional, when ready) | ⬜ |
| 10 | Cloudflare Tunnel on reclaimai.dev (when ready) | ⬜ |

---

## Where secrets live, and why

| Secret | Lives in | Why |
|---|---|---|
| `LLM_API_KEY`, `OPENROUTER_API_KEY`, `LANGCHAIN_API_KEY`, `PAYPAL_CLIENT_SECRET`, DB password, `SECRET_KEY`, Cloudflare tunnel token | Server: `~/reclaim/.env` | The app reads them at runtime on the server. Anyone with write access to the repo can read GitHub secrets by pushing a workflow that prints them, so these never go to GitHub. |
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

## Step 4: Fill in the API keys

```bash
ssh homelab
nano ~/reclaim/.env
```

Fill these lines (leave everything else as it is):

| Key | Where to get it |
|---|---|
| `LLM_API_KEY=` | ILMU console (the key for `api.ilmu.ai`, GLM-5.1), or ask the team for the one in their local `.env` |
| `OPENROUTER_API_KEY=` | https://openrouter.ai/keys → Create key (starts with `sk-or-v1-`) |
| `LANGCHAIN_API_KEY=` | Optional. https://smith.langchain.com → Settings → API Keys. If you set it, also set `LANGCHAIN_TRACING_V2=true` |

Save with `Ctrl+O`, `Enter`, exit with `Ctrl+X`.

Don't change:
- `POSTGRES_PASSWORD` and `SECRET_KEY`: generated already. After the first deploy the DB
  password is stored in the database volume, and changing it breaks the connection.
  Changing `SECRET_KEY` logs everyone out.
- `PAYPAL_MOCK_MODE=true`: leave it until step 9.
- `PUBLIC_URL=https://fil-laptop.tail36f260.ts.net`: already set for Funnel.

**Check:**

```bash
grep -E '^(LLM_API_KEY|OPENROUTER_API_KEY)=.+' ~/reclaim/.env | sed 's/=.*/=<set>/'
```

should print both names. `ls -l ~/reclaim/.env` should show `-rw-------`.

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
   (**Settings** → **Trust credentials**).
2. Click **Credential** → choose **OpenID Connect**.
3. Fill in:

   | Field | Value |
   |---|---|
   | Issuer | **GitHub Actions** (from the dropdown) |
   | Subject | `repo:michaelzhngg/PayPal:environment:production` |
   | Custom claims | leave empty |
   | Scopes | **Keys → Auth Keys: Write** |
   | Tags (appears after picking Auth Keys) | `tag:ci` |

   The subject must match exactly, case included. It works because the deploy job
   runs in the GitHub Environment named `production`. Runs from PRs or forks get a
   different subject and are refused.

   If `tag:ci` isn't selectable, step 5 wasn't saved.

4. Click **Generate credential**. Copy **Client ID** and **Audience**.
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
| Join tailnet | Subject or tag mismatch in step 6, or secrets missing | Re-check step 6 values; subject must be exactly `repo:michaelzhngg/PayPal:environment:production` |
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

## Step 10: Cloudflare Tunnel on reclaimai.dev (when ready)

`reclaimai.dev` is active on Cloudflare (DNS setup: Full) with two placeholder
records: `reclaimai.dev AAAA 100::` and `www.reclaimai.dev AAAA 100::`, both proxied,
and no rules use them.

**You don't add A records.** An A record would point at your home IP and need
port-forwarding. A tunnel is an outbound connection from the server, and Cloudflare
creates a proxied CNAME to it.

### 10.1 Remove the apex placeholder

1. https://dash.cloudflare.com → **reclaimai.dev** → **DNS** → **Records**.
2. Row `reclaimai.dev` / `AAAA` / `100::` → **Edit** → **Delete** → confirm.
3. Keep `www.reclaimai.dev` (used for the www → root redirect in 10.5).

### 10.2 Create the tunnel

1. Left sidebar → **Zero Trust** → **Networks** → **Tunnels** (if asked to choose a
   Zero Trust team name/plan, pick the **Free** plan).
2. **Create a tunnel** → **Cloudflared** → name `reclaim-homeserver` → **Save tunnel**.
3. On **Install and run connectors**, choose **Docker**. The command looks like
   `docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoi…`.
   Copy **only the token** (the long `eyJ…` string). **Don't run the command**: the
   stack already includes cloudflared.
4. **Next**.

### 10.3 Route the domain to the app

On **Route traffic** / **Public hostname**:

| Field | Value |
|---|---|
| Subdomain | (empty) |
| Domain | `reclaimai.dev` |
| Path | (empty) |
| Service type | `HTTP` |
| URL | `caddy:80` |

**Save tunnel**. Cloudflare creates the `reclaimai.dev CNAME <id>.cfargotunnel.com`
record. If it says a record already exists, 10.1 wasn't done.

### 10.4 Start the connector on the server

```bash
ssh homelab
nano ~/reclaim/.env
```

Uncomment and set (and change `PUBLIC_URL`):

```bash
PUBLIC_URL=https://reclaimai.dev
COMPOSE_PROFILES=cloudflare
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

```bash
~/reclaim/bin/deploy.sh apply
```

Then on your laptop:

```powershell
gh variable set PUBLIC_URL -R michaelzhngg/PayPal -b https://reclaimai.dev
```

**Check:**
- Zero Trust → Tunnels shows `reclaim-homeserver` as **Healthy**.
- https://reclaimai.dev opens the app.
- If you did step 9: change the PayPal return URL and webhook URL to
  `https://reclaimai.dev/api/v1/paypal/...`.

### 10.5 Optional extras

- **www → root:** reclaimai.dev → **Rules** → **Overview** → template **Redirect from
  WWW to root** → **Create from template** → Deploy.
- **SSL/TLS** → **Edge Certificates**: turn on **Always Use HTTPS**.
- **Funnel afterwards:** keep it as a backup URL (no action), or make it tailnet-only
  with `sudo tailscale funnel reset && sudo tailscale serve --bg 8080`.

No rebuild is needed for the domain switch. The frontend uses relative URLs.

---

## Done: what "live" looks like

- Every merge to `main`: tests → images → deploy → health check → live, or an
  automatic rollback and a red run.
- `ssh homelab '~/reclaim/bin/deploy.sh status'` shows the live release.
- Rollback any time: `ssh homelab '~/reclaim/bin/deploy.sh rollback'`, or Actions →
  CI/CD → **Run workflow** with `image_tag: sha-<commit>`.
