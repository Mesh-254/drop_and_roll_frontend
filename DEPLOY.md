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
`dist/` to the web root.

Put the production values in `.env.production` (gitignored) and run it:

```bash
# .env.production — layered on top of .env for mode=production
VITE_NEXT_PUBLIC_BACKEND_URL=https://dropnroll.co.uk
VITE_PUBLIC_GOOGLE_CLIENT_ID=<prod client id>
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<...>
VITE_GOOGLE_MAPS_API_KEY=<browser key>
VITE_TURNSTILE_SITE_KEY=<real site key>   # omit to keep the widget hidden
```

```bash
./deploy.sh
```

Keeping them in a file rather than exporting them is the point: `.env.production` is what
the *build* reads, so what you check is what you ship. Your everyday `.env` is still loaded
underneath, so `.env.production` only needs the values that differ from local dev — in
practice the `pk_live_` Stripe key and the real Turnstile site key.

`scripts/resolve-build-env.mjs` validates that resolved set before the build starts, using
the same `loadEnv()` and the same guard as `vite.config.js`. If a value is missing or still
a development one (`localhost`, `pk_test_`, a Turnstile test key, an `.env.example`
placeholder), the deploy stops before it touches the live site. To override a single value
for one run without editing a file — shell env wins over both files:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_<...> ./deploy.sh
```

### Demo deploy before the live Stripe account exists

To put the site in front of a client while Stripe is still in test mode:

```bash
ALLOW_TEST_STRIPE_KEY=1 ./deploy.sh
```

That is the only check with an escape hatch, and it is narrow on purpose:

- It must be typed on the command line. Putting `ALLOW_TEST_STRIPE_KEY=1` in `.env` or
  `.env.production` does nothing — the flag is read from `process.env`, never from the
  loaded env map, so it cannot become a permanent silent downgrade.
- The value must be exactly `1`. `true`, `yes` and `0` are all ignored.
- It relaxes the `pk_test_` check and nothing else. A localhost origin, a missing Maps key,
  a `VITE_`-prefixed secret and an `.env.example` placeholder all still stop the deploy.
- An *absent* Stripe key is still fatal. `loadStripe(undefined)` throws at module scope and
  takes the payment and invoice pages with it, which no demo wants either.
- A banner prints at the start of the build and again after the rsync, so the state of the
  live site is the last thing on screen.

**What a test-mode key actually means on a public site:** Stripe test mode rejects real
cards. Anyone who is not your client hits a payment step that cannot complete, and no
booking takes money. Treat a demo deploy as a window, not a state to leave the site in.
Redeploy with `pk_live_` in `.env.production` before it takes real traffic.

To see exactly what the build would resolve, without building or deploying:

```bash
node scripts/resolve-build-env.mjs production
```

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
