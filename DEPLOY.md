# Frontend deploy

## Topology

The SPA is a **static build served directly by nginx** on the same box and the **same
origin** as the API. There is no Node process in production and no `api.` subdomain.

```
  https://dropnroll.co.uk/            → /var/www/dropnroll  (this repo's dist/)
  https://dropnroll.co.uk/api/, /ws/  → 127.0.0.1:8000      (daphne, backend repo)
```

| Fact        | Value                                            |
| ----------- | ------------------------------------------------ |
| Host        | `116.203.121.98` (Hetzner, `ubuntu-16gb-nbg1`)   |
| Deploy user | `dropnroll`                                      |
| Web root    | `/var/www/dropnroll`                             |
| nginx site  | `/etc/nginx/sites-available/dropnroll_http.conf` |

nginx serves the SPA with a `try_files $uri /index.html` catch-all, so client-side routes
resolve on hard refresh. **No nginx reload is needed after a deploy** — the files are read
from disk per request.

## Same-origin is the whole design

`VITE_NEXT_PUBLIC_BACKEND_URL` must be `https://dropnroll.co.uk` — the site's own origin,
**not** an `api.` subdomain (none exists; that hostname does not resolve).

This matters more than it looks:

- WebSocket URLs are derived from it (`https→wss`, `http→ws`) in `src/utils/wsUrl.js` and
  `src/api/driver-api.js`. A wrong or `http://` value bakes a broken WS endpoint into the
  bundle and live tracking silently never connects.
- Because it is same-origin, cookies and CSRF work without cross-origin exemptions.

## Vite inlines env at BUILD time

`import.meta.env.VITE_*` values are substituted into the bundle when `npm run build` runs.
They are **not** read at runtime. Two consequences:

1. Production values must be present in the build environment — in CI, as job `env:`. There
   is no server-side config to fix a wrong value after the fact; you must rebuild.
2. Everything `VITE_`-prefixed ships to the browser and is readable by any visitor. Never
   put a secret in this repo's `.env`. See `.env.example`.

`src/utils/envCoherence.test.js` gates this: every `VITE_` var the source reads must be
documented in `.env.example`, and no server-side secret name may appear with a `VITE_`
prefix.

## Deploy

### Automated (push to `main`)

`.github/workflows/ci.yml`:

1. `test-and-lint` — lint (advisory), **`npm test` + `npm run build` (hard gate)**.
2. `deploy-frontend` — only on `push` to `main`, after the gate passes: `npm ci`, production
   build with prod env injected, then `rsync -az --delete dist/` to the web root.

PRs to `main`/`develop` run the gate only; nothing deploys.

After the gate, the job builds with the production env inlined, sanity-checks the artifact,
rsyncs, then verifies the live site actually serves the bundle it references. It is
`concurrency`-grouped so two pushes cannot rsync into the same web root at once — with
`--delete`, a half-finished mirror is a broken site.

> ⚠️ **Every value the app needs must be a secret here.** Vite inlines env at build time, so
> an omitted one is not "missing config" at runtime — it is baked in as `undefined` and the
> feature silently does nothing. `PROD_STRIPE_PUBLISHABLE_KEY`, `PROD_GOOGLE_MAPS_API_KEY`
> and `PROD_TURNSTILE_SITE_KEY` were previously absent from the job, so the build shipped
> without them.

| Secret                        | Value                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEPLOY_SSH_HOST`             | `116.203.121.98`                                                                                                                                |
| `DEPLOY_SSH_USER`             | `dropnroll`                                                                                                                                     |
| `DEPLOY_SSH_KEY`              | private key; public half in `dropnroll`'s `~/.ssh/authorized_keys`                                                                              |
| `PROD_BACKEND_URL`            | `https://dropnroll.co.uk` ← **not** `api.dropnroll.co.uk`                                                                                       |
| `PROD_GOOGLE_CLIENT_ID`       | production Google OAuth client id                                                                                                               |
| `PROD_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` — **required**; the build rejects `pk_test_` and rejects it being unset                                                             |
| `PROD_GOOGLE_MAPS_API_KEY`    | browser key, referrer-restricted in the Google Cloud console                                                                                    |
| `PROD_TURNSTILE_SITE_KEY`     | real site key. Leave **unset** to keep the widget hidden until `TURNSTILE_SECRET_KEY` is set on the backend — the widget alone verifies nothing |

`DEPLOY_PATH` is a workflow constant (`/var/www/dropnroll/`), not a secret: it is not
sensitive, and `secrets` values are masked in the log, which hurts when an rsync path is
wrong.

These are all public values that ship in the bundle. They live in secrets so they can be
rotated without a commit, not because they are confidential.

`rsync --delete` mirrors `dist/` exactly, dropping stale hashed assets. For a static SPA the
in-place update window is negligible; for strictly atomic releases, rsync to a timestamped
directory and swap an nginx-served symlink.

### Manual fallback

`deploy.sh` is an emergency hand-deploy from a workstation. It builds the **current branch**
(it no longer does `git checkout main`, which used to silently discard your work) and rsyncs
`dist/` to the web root. Export the `VITE_*` production values first, or keep them in a
local `.env` — otherwise you ship a build pointed at `127.0.0.1`.

```bash
export VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk
export VITE_PUBLIC_GOOGLE_CLIENT_ID=<prod client id>
export VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<...>
export VITE_GOOGLE_MAPS_API_KEY=<browser key>
export VITE_TURNSTILE_SITE_KEY=<real site key>   # omit to keep the widget hidden
./deploy.sh
```

The build refuses to run if any of these is missing or still carries a development value,
so a hand-deploy cannot quietly ship a localhost bundle. Easier still: keep them in
`.env.production` (gitignored) and just run `./deploy.sh`.

## Verify after deploy

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' https://dropnroll.co.uk/
curl -fsS https://dropnroll.co.uk/api/health/ && echo " backend OK"
```

Then hard-reload the site (bypass cache) and confirm in DevTools that the WebSocket to
`wss://dropnroll.co.uk/ws/...` connects. `index.html` is what pins the asset hashes, so a
stale cached `index.html` is the usual cause of a "deployed but nothing changed" report.

## Rollback

Re-run the deploy from the last-known-good commit (GitHub Actions → re-run, or push a
revert). Keep the previous `dist/` on the box before overwriting if you want an instant
restore.

## Lint backlog (known)

`develop` carries ~105 pre-existing eslint errors; `npm run lint` is advisory in CI so the
backlog does not block deploys. Tests + a successful production build are the hard gate.
Clear the backlog in a dedicated pass, then drop the `|| true` on the lint step.
