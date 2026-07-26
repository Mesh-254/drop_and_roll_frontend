# Frontend environment configuration

One codebase, two environments. Nothing here requires a code change to switch between them.

## Required variables

All six are `VITE_`-prefixed, which means **they are inlined into the public bundle and are
readable by any visitor**. None of them is a secret. Anything genuinely secret lives in the
backend `.env` and is never given a `VITE_` prefix.

| Variable | Local (development) | Production | Required? |
|---|---|---|---|
| `VITE_NEXT_PUBLIC_BACKEND_URL` | `http://127.0.0.1:8000` | `https://dropnroll.co.uk` | **Yes** |
| `VITE_PUBLIC_GOOGLE_CLIENT_ID` | dev OAuth client id | production OAuth client id | **Yes** |
| `VITE_GOOGLE_MAPS_API_KEY` | browser key (referrer-restricted) | browser key (referrer-restricted) | Yes, for maps |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | `pk_live_…` | Yes, for payments |
| `VITE_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (always passes) | real site key | Optional — widget hidden if unset |
| `VITE_USE_IDEAL_POSTCODES_PRIMARY` | unset (defaults `true`) | unset (defaults `true`) | No |

### Notes that bite

- **`VITE_NEXT_PUBLIC_BACKEND_URL` must be the site's own origin**, not an `api.` subdomain
  — `api.dropnroll.co.uk` does not resolve. nginx serves the SPA and proxies `/api/` and
  `/ws/` on the same host.
- **WebSocket URLs are derived from it** (`https→wss`, `http→ws`) in `src/utils/wsUrl.js` and
  `src/api/driver-api.js`. An `http://` value in production bakes in a `ws://` socket that
  browsers block from an https page, and live tracking dies silently.
- **The Turnstile test key means every bot passes.** It pairs with `TURNSTILE_SECRET_KEY` on
  the backend; the widget alone verifies nothing.
- **The Maps key is public by design.** Its only protection is the HTTP-referrer restriction
  in the Google Cloud console. Set that, or your quota is anyone's to spend.

## Which file is loaded

Vite selects by mode; later entries win, and real shell/CI environment variables beat all
files.

```
npm run dev     .env → .env.local → .env.development → .env.development.local
npm run build   .env → .env.local → .env.production  → .env.production.local
```

Every `.env*` file except `.env.example` is gitignored.

## Switching environments — no code changes

| | How production values arrive |
|---|---|
| **CI deploy** (push to `main`) | The `deploy-frontend` job sets `VITE_NEXT_PUBLIC_BACKEND_URL` and `VITE_PUBLIC_GOOGLE_CLIENT_ID` as build-time `env:` from repo secrets. No file needed. |
| **Manual `./deploy.sh`** | Refuses to run unless the `VITE_*` production values are exported. |
| **Local production build** | Put them in `.env.production` (gitignored). |

### The build guard

`npm run build` fails fast if the production configuration would ship development values —
a localhost or non-https backend origin, a missing Google client id, Stripe's `pk_test_`
key, Cloudflare's always-passes Turnstile key, or any `VITE_`-prefixed server secret. See
`src/config/assertProductionEnv.js` (unit-tested in `assertProductionEnv.test.js`).

This exists because the failure is otherwise invisible: with only `.env` present, a
production build inlines `127.0.0.1:8000`, produces a perfectly valid bundle, deploys
successfully, and yields a site that cannot reach its own API.

## Setup

```bash
cp .env.example .env      # then fill in the local values
npm ci
npm run dev
```

Verify configuration at any time:

```bash
npx jest src/utils/envCoherence.test.js src/config/assertProductionEnv.test.js
```

`envCoherence.test.js` gates that every `VITE_` var read by `src/` is documented in
`.env.example`, that nothing reads a non-`VITE_` name from `import.meta.env` (Vite drops
those, so they are always `undefined`), and that no server-side secret name carries a
`VITE_` prefix.

## Security posture

- No `.env*` file except `.env.example` is committed; full git history was scanned for
  credential patterns with zero hits.
- `dist/` is gitignored and has never been committed.
- The built bundle was scanned for server-side secret names and values (`sk_live_`,
  `sk_test_`, `whsec_`, `IDEAL_POSTCODES`, `CLIENT_SECRET`, `POSTGRES_PASSWORD`,
  `TURNSTILE_SECRET`, private keys) — none present.
- The four public keys that *are* inlined (backend origin, Google client id, Maps browser
  key, Stripe publishable key) are public by design. Protect them with origin/referrer
  restrictions in the Google and Stripe consoles, not by hiding them.
