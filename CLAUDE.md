# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server at http://localhost:3000
npm run build        # Production build to dist/
npm run preview      # Preview production build locally
npm run type-check   # TypeScript validation without emitting files
npm run deploy       # Deploy dist/ to Cloudflare Pages via wrangler
npm run cf:dev       # Run Cloudflare Pages Functions locally (port 8788) with live reload
```

No linting or test scripts are configured.

## Architecture

This is a **React 18 SPA** (Vite + TypeScript) deployed to **Cloudflare Pages**, with serverless API endpoints as **Cloudflare Functions** in `functions/api/`. The frontend dev server proxies `/api/*` requests to `localhost:8788` (the Cloudflare Workers runtime).

### Routing

Wouter handles client-side routing in `src/App.tsx`. All paths fall back to `index.html` via `public/_redirects`. Routes: `/` (home), `/login`, `/register`, `/support`.

### API Layer

`functions/api/` contains three Cloudflare Functions that bridge the frontend to WHMCS:
- `domains/check.ts` → WHMCS `DomainWhois` API
- `auth/login.ts` → WHMCS `ValidateLogin` API
- `support/ticket.ts` → WHMCS `OpenTicket` API

`src/lib/whmcs-client.ts` is the frontend-side WHMCS client (calls these Workers). WHMCS credentials (`WHMCS_API_IDENTIFIER`, `WHMCS_API_SECRET`) are stored as Cloudflare secrets in production and in `.env` locally.

### Key Libraries

- **Gleap** (`gleap` npm package) — customer feedback widget, initialized in `src/App.tsx` via `useEffect`. Helper functions for user identification and event tracking are in `src/lib/gleap.ts`.
- **Framer Motion** — animations, code-split into its own chunk
- **tsParticles** — animated background in `AnimatedBackground.tsx`
- **Wouter** — lightweight SPA router (no React Router)

### Styling

No CSS framework. Custom design system via CSS custom properties defined in `src/styles/global.css`. Components use inline `<style>` blocks. Dark theme is default; light theme is a full CSS property inversion.

### Deployment

Cloudflare Pages auto-deploys from GitHub on push. For manual deploys: `npm run build && npm run deploy`. KV namespace (`DOMAIN_ANALYTICS`) must be bound in `wrangler.toml` for analytics to work. Cloudflare security headers are set in `public/_headers`.
