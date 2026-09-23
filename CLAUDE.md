# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run type-check   # TypeScript validation without emitting files
npm run deploy       # wrangler deploy (manual fallback; Workers Builds deploys from GitHub)
npm run cf:dev       # wrangler dev: serves dist/ + the Worker on port 8787 (build first)
npm test             # Worker + lib tests (node --test, fakes only, never touches the network)
```

Local development needs two processes: `npm run build && npm run cf:dev` for the Worker (reads secrets from `.dev.vars`) and `npm run dev` for the frontend. With only Vite running, every domain search falls back to the WHMCS cart on wrld.host. The Workers AI binding is always remote, so `cf:dev` needs `npx wrangler login`; without it, run wrangler against a local copy of `wrangler.jsonc` without the `ai` block and set `SUGGEST_ENGINE=wordplay`. No linter is configured.

## Architecture

This is a **React 18 SPA** (Vite + TypeScript) deployed as a **Cloudflare Worker with Static Assets**: `dist/` is served by the asset layer and `src/worker/index.ts` answers `/api/*` (config in `wrangler.jsonc`). The frontend dev server proxies `/api/*` requests to `localhost:8787` (`wrangler dev`). When that proxy is down the domain search degrades to a plain form submit against WHMCS.

### Routing

Wouter handles client-side routing in `src/App.tsx`. All paths fall back to `index.html` via `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`; `/api/*` is routed to the script first via `run_worker_first`. Routes: `/` (home), `/login` and `/register` (handoff pages that send people to wrld.host), `/support`.

`src/lib/usePageTitle.ts` sets the per-route title and rewrites `<link rel="canonical">` to the current route (the 404 page removes it), because the shell in `index.html` is served for every path.

Every outbound URL lives in `src/lib/links.ts`. Add new destinations there, not inline. Sign-in is never handled on this site: WHMCS requires a per-session CSRF token, so `/login` hands off to `https://wrld.host/login`.

### API Layer

`src/worker/` is the Worker script. Every integration switches on only when its credentials exist; `config.ts` is the one place that reads env for features, and `GET /api/config` tells the UI what is live (never secrets).
- `index.ts` routes `/api/domains/check`, `/api/domains/suggest`, `/api/config`, `/api/checkout`, `/api/checkout/status`, `/api/stripe/webhook`; other `/api/*` get a JSON 404, everything else goes to `ASSETS`.
- `providers/` is the availability chain: `cloudflare.ts` (Registrar `domain-check`, authoritative, 20 per call, carries cost), `whmcs.ts` (DomainWhois, needs `WHMCS_API_ACCESS_KEY` from a Worker), `rdap.ts` (free fallback; 404 = "looks available", never "available"). `index.ts` runs them in order, lets an `error` for one domain fall through to the next provider, streams definite answers as they land, and puts a short edge cache in front. `toPublic` strips the cost basis before anything leaves the Worker.
- `domains-check.ts` → up to 20 domains; JSON by default, NDJSON (`Accept: application/x-ndjson`) for streaming rows. A price is attached only when it's exactly what direct checkout would charge (`publicResult`).
- `suggest.ts` + `suggest-engine.ts` → "Describe your business": Claude (`@anthropic-ai/sdk`, `claude-opus-5`, low effort, JSON-schema output, `fallbacks: "default"`) → Workers AI → deterministic wordplay. Names are filtered to `SUGGEST_TLDS` (from the ADAC config in Craft) and checked through the same chain.
- `checkout.ts` + `stripe.ts` → direct checkout: Stripe Checkout Session with a per-TLD product created on first sale (`wrld_domain_<tld>`), webhook signature check with WebCrypto, fulfilment at Cloudflare Registrar. Re-checks cost and availability before charging and after payment; dry run unless `REGISTRAR_LIVE=true`; orders in the `ORDERS` KV keyed by session ID.
- `pricing.ts` → retail = cost × (1 + `PRICE_MARKUP_PERCENT`) + `PRICE_MARKUP_FIXED_CENTS` (default +$3.00).
- Tests sit next to the code (`*.test.ts`) and share fakes in `test-helpers.ts`. Runtime imports in the Worker use explicit `.ts` extensions so Node can load them; type-only imports may use the `@/` alias.

`src/lib/whmcs-client.ts` is the server-side WHMCS client (only imported by the Worker). `src/lib/domains.ts` holds the domain parsing/validation shared by the UI and the Worker. `src/lib/api.ts` is the browser side (config, NDJSON reader, checkout). `cartUrl` in `src/lib/links.ts` deep-links a domain straight into the WHMCS cart with `domains[]`, and uses `query=` only when WHMCS must check or price the name itself. The full variable and secret list, and the direct-checkout rollout, are in DEPLOYMENT.md.

The search console (`DomainSearch.tsx`) has three candidate button looks behind `?look=beacon|button|command` (`src/lib/look.ts`, `LookSwitcher.tsx`, reviewer-only). Once one is chosen, delete the others.

### Key Libraries

- **Gleap** (WRLD Help) — loaded by the HTML snippet in `index.html`, matching wrld.host. `src/lib/gleap.ts` wraps `window.Gleap` with optional chaining; there is no npm SDK dependency.
- **lucide-react** — the design system's icon set. 1.5px stroke, `currentColor`, sizes 16/18/20/24. No emoji anywhere in the UI.
- **Wouter** — lightweight SPA router (no React Router). `src/components/Anchor.tsx` picks `Link` vs `<a>` based on the href.

### Styling: the WRLD design system

The site consumes the WRLD design system (https://wrld.design, repo `WRLDInc/DesignSystem`, local checkout at `../DesignSystem`).

- `src/styles/wrld/tokens.css` and `src/styles/wrld/colors_and_type.css` are vendored copies of the upstream files (v0.4.0, commit 180910c). Don't edit them; re-copy from upstream. The only change is font URLs pointing at `/fonts/`.
- Fonts (Montserrat, Ubuntu, Ubuntu Mono), the starburst mark, and favicons are copied into `public/fonts`, `public/logos`, `public/favicons`.
- `src/styles/global.css` is the single app stylesheet. Components use class names, not inline `<style>` blocks.
- Themes: `data-theme` on `<html>` is `light`, `dark`, or `auto` (default, follows the OS). `index.html` applies the saved choice before first paint; `ThemeToggle` flips it.

Rules that matter when adding UI (from the design system's brand brief):
- Static surfaces stay monochrome. Accent colour appears only on hover, focus, motion, and status dots. No gradient fills.
- This property follows the wrld.host brief: default hover accent is `--accent-secondary` (#00adee); commerce CTAs (register, transfer) use `--accent-warm` (#EE9300) via `.btn-warm`.
- Sentence case for headings, labels and buttons. Uppercase only for eyebrows and nav micro-labels.
- Naming: "WRLD" in prose, "WRLD.host" / "WRLD.domains" for the properties, "wrld.tech" and "wrld.design" lowercase, lowercase `wrld.host` only when showing a literal URL. Never "Wrld".
- Motion is tight, never springy: 120/200/320/600ms with the `--wrld-ease-*` curves. `prefers-reduced-motion` collapses everything.
- Radii: 4px inputs/buttons, 8px cards, pills for badges. Hairline borders.

Signature motion pieces (both keep static surfaces monochrome):
- `src/components/TopoField.tsx` draws the home hero: a raw-WebGL topographic contour field. The pointer acts as a survey point that raises the terrain into rings and lets the three accents flow along the nearest lines, trailing pointer velocity. Ink comes from `color` (`--fg`), opacity from `--topo-alpha`. It honours reduced motion and pauses off-screen.
- `src/components/RollText.tsx` is the wrld.design CTA roll-text label; the hover copy is CSS-generated so the accessible name stays single. Use it only on hero and closing CTAs, per the design system.

### Deployment

Workers Builds (the Git integration on the Worker) builds every push with `npm run build` and deploys with `npx wrangler deploy`; `main` is production, other branches get preview versions. `.github/workflows/ci.yml` only type-checks, tests, builds, and runs `wrangler deploy --dry-run`. The Worker `name` in `wrangler.jsonc` must match the dashboard. The custom-domain `routes` block is commented out until the preview is verified; see DEPLOYMENT.md. Security and cache headers are set in `public/_headers` (fonts are listed by exact filename so a missing font never caches a 404). `www.wrld.domains` needs a zone Redirect Rule to the apex; `_redirects` can't match hostnames on Workers.
