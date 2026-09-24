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

Workers & Pages → the Worker → Settings → Variables and Secrets. These are runtime bindings, a different store from build variables. **Every integration switches on only when its credentials exist** (`src/worker/config.ts`), and `GET /api/config` reports what is live, so a half-configured deploy degrades instead of breaking: a bare deploy still searches (RDAP) and still sells (WHMCS cart handoff).

> **Secrets in the dashboard, vars in `wrangler.jsonc`.** Secrets set in the dashboard (or with `wrangler secret put`) survive deploys. Plain vars do not: every Workers Builds deploy replaces them with the `vars` block in `wrangler.jsonc`, so a var edited in the dashboard silently reverts on the next push. Change `DOMAIN_PROVIDERS`, `CHECKOUT_MODE`, `REGISTRAR_LIVE`, `CF_REGISTRAR_SANDBOX` and the price vars by pull request.

### Availability providers (checked in this order)

| Provider | Needs | Notes |
| --- | --- | --- |
| Cloudflare Registrar `domain-check` | `CF_ACCOUNT_ID` (var, set) + `CF_REGISTRAR_API_TOKEN` (secret) | Registry-authoritative, 20 names per call, returns Cloudflare's at-cost price. Beta API. Token needs Registrar read (and write for direct checkout). |
| WHMCS `DomainWhois` | `WHMCS_API_IDENTIFIER`, `WHMCS_API_SECRET`, **`WHMCS_API_ACCESS_KEY`** (secrets) | One name per call, slow. WHMCS restricts the API by IP and Workers have no fixed egress IP, so set `$api_access_key` in WHMCS `configuration.php` and put the same value in `WHMCS_API_ACCESS_KEY`. |
| RDAP | nothing | Free fallback. A 404 means "not registered", not "purchasable", so the UI labels these "Looks available" and WHMCS confirms at checkout. `.co` has no working RDAP server. |

`DOMAIN_PROVIDERS` (var, set in `wrangler.jsonc`) overrides the order, e.g. `cloudflare,rdap`, or `rdap,whmcs` to spare wrld.host when WHMCS is the only registrar-grade source. Searches abandoned mid-typing are cancelled upstream (the `enable_request_signal` compatibility flag), and each WHMCS call times out after 8 seconds. eNom is not usable from a Worker (it requires a whitelisted static IP), and RealtimeRegister's REST check is ruled out for search traffic by its acceptable-use policy; see the roadmap for ADAC.

### AI suggestions ("Describe your business")

| Engine | Needs | Notes |
| --- | --- | --- |
| Claude | `ANTHROPIC_API_KEY` (secret) | Default model `claude-opus-5` at low effort with server-side refusal fallback; override with `SUGGEST_MODEL` (e.g. a faster, cheaper model). |
| Workers AI | the `ai` binding (already in `wrangler.jsonc`) | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` in JSON mode. On by default, so the feature works in production with no key. |
| Wordplay | nothing | Deterministic fallback when every AI engine fails. `SUGGEST_ENGINE=wordplay` turns the feature on with only this engine (local dev). |

Every generated name is filtered to WRLD's TLD list (from the ADAC config in Craft) and checked live before it is shown. `SUGGEST_LIMITER` caps the route at 8 requests per minute per IP.

### Direct checkout (Stripe → Cloudflare Registrar)

Off by default (`CHECKOUT_MODE=whmcs`). It needs **all** of: `CHECKOUT_MODE=direct|both`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, an `ORDERS` KV binding, `ORDER_WEBHOOK_URL`, the Cloudflare Registrar token, **and matching modes**: a Stripe test key only with the sandbox or a dry run, a live key only with `CF_REGISTRAR_SANDBOX=false` and `REGISTRAR_LIVE=true`. While any of that is missing or mismatched, `/api/checkout` answers 503 and every Register button hands off to the WRLD.host cart, so a half-finished go-live can't take test money for real domains or real money for nothing.

| Name | Kind | Purpose |
| --- | --- | --- |
| `CHECKOUT_MODE` | var | `whmcs` (default) · `direct` · `both` (the sheet offers card checkout and WRLD.host side by side) |
| `DIRECT_TLDS` | var, optional | Comma list to limit quick checkout, e.g. `com,net,dev`. Empty = whatever Cloudflare sells. |
| `STRIPE_SECRET_KEY` | secret | Sandbox key (`sk_test_…`) until go-live. |
| `STRIPE_WEBHOOK_SECRET` | secret | From the webhook endpoint `https://<host>/api/stripe/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. |
| `ORDERS` | KV binding | `npx wrangler kv namespace create ORDERS`, then uncomment it in `wrangler.jsonc`. Order records and webhook idempotency. |
| `CF_REGISTRAR_SANDBOX` | var | `true` (default) uses the registrar sandbox: com/net only, no billing. |
| `REGISTRAR_LIVE` | var | Must be exactly `true` before a paid order calls the registrar. Anything else records a dry run. |
| `PRICE_MARKUP_FIXED_CENTS` / `PRICE_MARKUP_PERCENT` | vars | Retail = cost × (1 + percent) + fixed. Default +$3.00 flat, which covers Stripe fees. **Business decision pending.** |
| `ORDER_WEBHOOK_URL` | secret, **required** | Slack-compatible incoming webhook; one line per order and every state change. Orders that stop for review must reach a person. |

Stripe products are created automatically, one per TLD with a stable ID (`wrld_domain_com`, `wrld_domain_co_uk`, …) the first time that TLD sells; prices are passed per session because they follow the registrar's live cost. The sandbox already has the eight popular TLD products.

Guard rails the code enforces: availability and cost are re-checked at the registrar when the session is created **and** after payment (a higher cost or a taken name stops the order as `needs_review` instead of registering at a loss; a registrar outage answers Stripe with a 503 so it retries later), Stripe and registrar modes must match, only sessions tagged `metadata.source=wrld.domains` are processed, premium names and TLDs with a registry minimum over one year (`.ai`) never go through direct checkout, sales are one year, cost basis never reaches the browser, and orders are keyed by Checkout Session ID so webhook retries are no-ops. The claim and the order record live under separate KV keys, each written once per attempt (KV allows one write per second per key). While a registration is in flight, the success page asks Cloudflare for its status at most every 20 seconds and records the result.

Staged rollout:

1. Sandbox rehearsal: Stripe test keys, `CF_REGISTRAR_SANDBOX=true`, `REGISTRAR_LIVE=false`, `CHECKOUT_MODE=both`. Buy a `.com` with Stripe's test card; the order lands as `dry_run`.
2. Registrar sandbox: set `REGISTRAR_LIVE=true` (still sandbox). Orders should reach `registering`/`registered` with no billing.
3. Go-live, after the prerequisites below: live Stripe keys, `CF_REGISTRAR_SANDBOX=false`, and `DIRECT_TLDS` limited to a few TLDs first. The mode check keeps quick checkout off in any moment where the key and the registrar vars disagree.

Go-live prerequisites (not needed for the sandbox rehearsal):

- Legal review of reselling under Cloudflare's Domain Registration Agreement, and a renewal policy (the API can't renew).
- Move orders from KV to D1 or a Durable Object, with fulfilment from a Queue. KV is eventually consistent, so the claim is a best-effort lock; Cloudflare's one-registration-per-domain rule is the backstop today.
- A scheduled sweep for registrations left `registering` after the customer closes the success page.
- Turnstile on `/api/checkout`. The Cloudflare API allows 1,200 requests per five minutes **per user**, shared by search, checkout and fulfilment; a separate Cloudflare user (not just a separate token) for fulfilment keeps a search surge from starving paid orders.
- Registrant names must be ASCII for Cloudflare; orders with non-Latin names land in `needs_review` for manual handling.

Known limits of the Cloudflare Registrar API (beta, 2026-04): no renewals, transfers or contact updates via API; premium names unsupported; 500 domains per account; domains must use Cloudflare nameservers; registrations bill WRLD's default payment method and are non-refundable.

### Abuse controls and analytics

`SEARCH_LIMITER` (120/min per IP) and `SUGGEST_LIMITER` (8/min per IP, shared by AI suggestions and checkout attempts under separate keys) are Workers Rate Limiting bindings declared in `wrangler.jsonc`. `DOMAIN_ANALYTICS` (optional KV) records each lookup for 90 days.

Secrets can also be set from a logged-in terminal:

```bash
npx wrangler secret put CF_REGISTRAR_API_TOKEN
npx wrangler secret put WHMCS_API_ACCESS_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

Local development reads the same names from `.dev.vars` (see `.env.example`). The Workers AI binding is always remote, so `wrangler dev` needs `npx wrangler login`; without it, use a local config without the `ai` block and `SUGGEST_ENGINE=wordplay`.

## 3. Verify a preview before moving the domain

Every push builds. Open the preview URL from the build (or the `workers.dev` URL for `main`) and check:

```bash
BASE=https://<preview-host>
curl -sI $BASE/                      # 200, text/html
curl -sI $BASE/support               # 200, text/html (SPA fallback)
curl -sI $BASE/fonts/Ubuntu-Regular.ttf | grep -i cache-control   # immutable, from public/_headers
curl -s  $BASE/api/domains/check                                  # 405 JSON
curl -s -X POST -H 'Content-Type: application/json' -d 'null' $BASE/api/domains/check   # 400 JSON
curl -s -X POST -H 'Content-Type: application/json' -d '{"domains":["google.com","wrldtest9x.com"]}' $BASE/api/domains/check   # results; "source" shows which provider answered
curl -sN -X POST -H 'Content-Type: application/json' -H 'Accept: application/x-ndjson' -d '{"domains":["acme.com","acme.dev"]}' $BASE/api/domains/check   # streamed, one line per domain
curl -s  $BASE/api/config                                         # which providers, AI engine and checkout mode are live
```

Then on a phone-width window (320px and 375px): the header actions sit at the right edge, the search console and its button are visible without scrolling, results stream in as you type, and the "Describe your business" tab returns checked names. `?look=beacon|button|command` switches the three candidate button treatments for review.

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
`/api/config` isn't answering or reports `availability.live: false` (no provider configured, e.g. `DOMAIN_PROVIDERS` excludes RDAP). Check the Worker's logs.

**Results say "Looks available" but WHMCS says taken or reserved**
That answer came from RDAP, which can't see reserved, blocked or premium names. Configure the Cloudflare Registrar token so registrar-confirmed answers come first.

**WHMCS provider always errors** (results keep showing `"source":"rdap"`)
The Worker logs `[availability] whmcs could not answer N of M: <reason>` with WHMCS's own message. `Invalid IP …` means `$api_access_key` is missing from `configuration.php` or doesn't match the `WHMCS_API_ACCESS_KEY` secret; an authentication error means the identifier or secret is wrong; a permissions error names the API action the credential's role doesn't allow (it needs `DomainWhois`, and the admin's role group needs **API Access**).

**"Describe your business" tab is missing**
No AI engine is configured: the `ai` binding is absent and there's no `ANTHROPIC_API_KEY`. Locally, set `SUGGEST_ENGINE=wordplay`.

**Direct checkout never appears**
`/api/config` shows `checkout.direct.enabled: false` until every requirement above is met; the Worker logs don't list secrets, so compare against the table.

## Roadmap

- **RealtimeRegister ADAC** for as-you-type search and its suggestion engines (DomainsBot, NameStudio AI prompts, Relevant Name Search), already configured for wrld.domains per the ADAC doc in Craft. Needs the ADAC API key and TLD-set token, and answers from RTR on origin allow-listing and rate limits.
- **Stripe → WHMCS fulfilment** (`AddOrder` + payment applied), so card checkout on this site keeps WHMCS as the system of record for renewals, DNS and the client area.
- **Renewal billing** for anything registered directly at Cloudflare (the API can't renew yet).
- Pick one of the three search-button looks and delete the other two (`src/lib/look.ts`, `global.css`).

**Custom domain deploy refused**
The hostname is still attached to the old Pages project. Detach it there, then redeploy.
