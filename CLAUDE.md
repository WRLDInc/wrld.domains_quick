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
npm test             # Worker route tests for /api/domains/check (node --test, no WHMCS calls)
```

Local development needs two processes: `npm run build && npm run cf:dev` for the Worker (reads WHMCS secrets from `.dev.vars`) and `npm run dev` for the frontend. With only Vite running, every domain search falls back to the WHMCS cart on wrld.host. No linter is configured.

## Architecture

This is a **React 18 SPA** (Vite + TypeScript) deployed as a **Cloudflare Worker with Static Assets**: `dist/` is served by the asset layer and `src/worker/index.ts` answers `/api/*` (config in `wrangler.jsonc`). The frontend dev server proxies `/api/*` requests to `localhost:8787` (`wrangler dev`). When that proxy is down the domain search degrades to a plain form submit against WHMCS.

### Routing

Wouter handles client-side routing in `src/App.tsx`. All paths fall back to `index.html` via `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`; `/api/*` is routed to the script first via `run_worker_first`. Routes: `/` (home), `/login` and `/register` (handoff pages that send people to wrld.host), `/support`.

`src/lib/usePageTitle.ts` sets the per-route title and rewrites `<link rel="canonical">` to the current route (the 404 page removes it), because the shell in `index.html` is served for every path.

Every outbound URL lives in `src/lib/links.ts`. Add new destinations there, not inline. Sign-in is never handled on this site: WHMCS requires a per-session CSRF token, so `/login` hands off to `https://wrld.host/login`.

### API Layer

`src/worker/` is the Worker script:
- `index.ts` routes `/api/domains/check` to the handler, other `/api/*` to a JSON 404, and everything else to the `ASSETS` binding.
- `domains-check.ts` → WHMCS `DomainWhois` (one call per domain, run in parallel, max 10). Used by the inline availability results on the home page. 405 on non-POST, 400 on bad bodies, 503 when the WHMCS secrets are missing (the UI then falls back to WHMCS's own checker).
- `domains-check.test.ts` covers those paths under `node --test`. Runtime imports in the Worker use explicit `.ts` extensions so Node can load them.

`src/lib/whmcs-client.ts` is the server-side WHMCS client (only imported by the Worker). `src/lib/domains.ts` holds the domain parsing/validation shared by the UI and the check function. `WHMCS_URL` is a var in `wrangler.jsonc`; `WHMCS_API_IDENTIFIER` and `WHMCS_API_SECRET` are Worker secrets in production and live in `.dev.vars` locally. The `DOMAIN_ANALYTICS` KV binding is optional.

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
