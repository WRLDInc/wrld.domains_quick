# Deployment Guide

wrld.domains runs as a **Cloudflare Worker with Static Assets**: the Vite build in `dist/` is served by Cloudflare's asset layer, and a small Worker script (`src/worker/index.ts`) answers `/api/*`. Builds and deploys come from **Workers Builds**, the Git integration on the Worker, straight from `WRLDInc/wrld.domains_quick`.

The configuration lives in [`wrangler.jsonc`](wrangler.jsonc). The previous Cloudflare Pages project (`wrld-domains-quicksite`) is no longer the deploy target.

## 1. Workers Builds settings

Workers & Pages → the Worker → Settings → Build.

| Setting | Value | Notes |
| --- | --- | --- |
| Git repository | `WRLDInc/wrld.domains_quick` | |
| Production branch | `main` | |
| Build command | `npm run build` | Vite → `dist/` |
| Deploy command | `npx wrangler deploy` | The default. Uses the wrangler version pinned in `package.json`. |
| Non-production deploy command | `npx wrangler versions upload` | Uploads a preview version without touching production traffic. |
| Root directory | *leave empty* | `wrangler.jsonc` is at the repo root |
| Builds for non-production branches | enabled | Every pull request gets a preview URL |

The `name` in `wrangler.jsonc` must match the Worker's name in the dashboard. Workers Builds papers over a mismatch in CI, but a local `npm run deploy` would then create a second Worker.

## 2. Runtime variables and secrets

Workers & Pages → the Worker → Settings → Variables and Secrets. These are runtime bindings, a different store from build variables.

| Name | Kind | Purpose |
| --- | --- | --- |
| `WHMCS_URL` | var (set in `wrangler.jsonc`) | `https://wrld.host` |
| `WHMCS_API_IDENTIFIER` | secret | WHMCS API credential |
| `WHMCS_API_SECRET` | secret | WHMCS API credential |
| `DOMAIN_ANALYTICS` | KV binding, optional | Records each availability lookup for 90 days. Uncomment the block in `wrangler.jsonc` and bind a namespace. |

Without the two secrets the Worker answers `/api/domains/check` with 503 and the search form falls back to the WHMCS cart. Nothing else breaks.

Secrets can also be set from a logged-in terminal:

```bash
npx wrangler secret put WHMCS_API_IDENTIFIER
npx wrangler secret put WHMCS_API_SECRET
```

## 3. Verify a preview before moving the domain

Every push builds. Open the preview URL from the build (or the `workers.dev` URL for `main`) and check:

```bash
BASE=https://<preview-host>
curl -sI $BASE/                      # 200, text/html
curl -sI $BASE/support               # 200, text/html (SPA fallback)
curl -sI $BASE/fonts/Ubuntu-Regular.ttf | grep -i cache-control   # immutable, from public/_headers
curl -s  $BASE/api/domains/check                                  # 405 JSON
curl -s -X POST -H 'Content-Type: application/json' -d 'null' $BASE/api/domains/check   # 400 JSON
curl -s -X POST -H 'Content-Type: application/json' -d '{"domains":["example.com"]}' $BASE/api/domains/check   # 503 until secrets exist, then results
```

## 4. Attach the custom domain

When the preview looks right, uncomment the `routes` block in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "wrld.domains", "custom_domain": true }]
```

and merge. The next production deploy attaches `wrld.domains` to this Worker. If the hostname is still bound to the old Pages project, remove it there first (Pages → project → Custom domains), otherwise the deploy will refuse to take it.

`www.wrld.domains` is not a second custom domain. Send it to the apex with a Cloudflare **Redirect Rule** on the zone (`www.wrld.domains/*` → `https://wrld.domains/$1`, 301). A `_redirects` file cannot do this on Workers; it matches paths, not hostnames.

## 5. Manual deploy (fallback)

```bash
npx wrangler login
npm run build
npm run deploy          # wrangler deploy
```

Only do this against the same Worker name as the dashboard, and prefer Workers Builds so the deployed commit is traceable.

## 6. Rollback

Workers & Pages → the Worker → Deployments → choose an earlier version → Rollback. Static assets and the script roll back together.

## Troubleshooting

**Build fails with "Missing entry-point to Worker script or to assets directory"**
The build ran against a Pages-style config. `wrangler.jsonc` must be at the repo root with `main` and `assets` set; the root directory setting in the dashboard must be empty.

**`/support` returns 404 on a hard load**
`assets.not_found_handling` must be `single-page-application` (it is, in `wrangler.jsonc`).

**`/api/domains/check` returns `index.html`**
`assets.run_worker_first` must include `/api/*` so the script sees those requests before the asset layer answers.

**Every search redirects to wrld.host**
The Worker is answering 503 because the WHMCS secrets are missing. Set them under Variables and Secrets and redeploy.

**Custom domain deploy refused**
The hostname is still attached to the old Pages project. Detach it there, then redeploy.
