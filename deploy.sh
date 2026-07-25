#!/usr/bin/env bash
# MANUAL FALLBACK ONLY. The intended path is automatic: push/merge to `main` triggers
# .github/workflows/ci.yml -> deploy-frontend (prod build + rsync to the box).
#
# This script exists for emergency hand-deploys from a workstation. Unlike the original it
# does NOT `git checkout main` (that silently discarded whatever branch you were on). It
# builds and ships the CURRENT working tree as-is.
#
# Target is the Hetzner box. The previous hardcoded `wolftech@158.69.36.39` was an OVH host
# from a former provider and has been dead since the migration — anything "deployed" there
# went nowhere. Override via env if the host ever moves again.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-dropnroll}"
DEPLOY_HOST="${DEPLOY_HOST:-116.203.121.98}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/dropnroll/}"

# Vite INLINES these at build time; they are not read at runtime. Missing values do not
# error, they silently bake `undefined` (or a localhost default) into the bundle and the
# site ships pointing at nothing. So refuse to build rather than produce a broken artifact.
: "${VITE_NEXT_PUBLIC_BACKEND_URL:?set it, e.g. https://dropnroll.co.uk (same origin as the SPA, NOT api.dropnroll.co.uk)}"
: "${VITE_PUBLIC_GOOGLE_CLIENT_ID:?set it to the production Google OAuth client id}"

echo "Building from branch: $(git branch --show-current)"
echo "  backend URL: ${VITE_NEXT_PUBLIC_BACKEND_URL}"
npm run build

# Guard against shipping an empty or failed build over the live site: --delete would
# happily mirror an empty dist/ and take the site down.
if [ ! -s dist/index.html ]; then
  echo "!! dist/index.html missing or empty — refusing to deploy" >&2
  exit 1
fi

echo "Deploying to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH} (rsync --delete mirrors dist/)..."
rsync -az --delete dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"

echo "DEPLOYED. Verify with a cache-bypassing reload; nginx needs no reload."
