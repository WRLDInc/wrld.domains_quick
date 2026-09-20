# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

WRLD.domains Quick Search - A React/TypeScript frontend for domain availability checking, deployed as a Cloudflare Worker with Static Assets (Vite build in `dist/`, `/api/*` handled by `src/worker/index.ts`). Integrates with WHMCS at wrld.host for domain registration, authentication, and support ticketing.

## Commands

```bash
# Development
npm run dev              # Start Vite dev server at localhost:3000
npm run cf:dev           # wrangler dev: dist/ assets + the Worker on port 8787 (build first)

# Build & Deploy
npm run build            # Production build to dist/
npm run preview          # Preview production build
npm run deploy           # wrangler deploy (manual fallback; Workers Builds deploys from GitHub)
npm run type-check       # TypeScript type checking without emit

# Cloudflare Secrets (production)
wrangler secret put WHMCS_API_IDENTIFIER
wrangler secret put WHMCS_API_SECRET
```

## Architecture

### Frontend → Backend → WHMCS Flow
```
React pages → /api/* (Worker script) → WHMCS API (wrld.host)
```

The frontend makes requests to `/api/*` endpoints handled by the Worker script in `src/worker/`. The script uses `WHMCSClient` (`src/lib/whmcs-client.ts`) to communicate with the WHMCS installation at wrld.host. Everything outside `/api/*` is served from `dist/` by Cloudflare's static-asset layer, with `index.html` as the SPA fallback.

### API Endpoints (Worker)
- `POST /api/domains/check` → `src/worker/domains-check.ts` (WHMCS `DomainWhois`, up to 10 domains in parallel; 405 on other methods, 400 on bad bodies, 503 when secrets are missing)
- any other `/api/*` → JSON 404

The handler receives `(request, env, ctx)`: `env` carries `WHMCS_URL`, the two WHMCS secrets, the optional `DOMAIN_ANALYTICS` KV binding, and `ASSETS`; `ctx.waitUntil` is used for analytics writes.

### WHMCS Client Pattern
```typescript
import { WHMCSClient } from '@/lib/whmcs-client';

const client = new WHMCSClient({
  url: context.env.WHMCS_URL,
  apiIdentifier: context.env.WHMCS_API_IDENTIFIER,
  apiSecret: context.env.WHMCS_API_SECRET,
});
```

Key methods: `checkDomainAvailability()`, `validateLogin()`, `openTicket()`, `getClientDetails()`, `addClient()`

### Environment Types
Environment bindings are typed in `src/types/env.d.ts`:
- `CloudflareEnv` - Worker environment (WHMCS credentials, KV namespace)
- Uses `DOMAIN_ANALYTICS` KV namespace for query analytics (90-day TTL)

## Code Patterns

### Path Alias
The `@/` alias maps to `src/` (configured in `vite.config.ts` and `tsconfig.json`):
```typescript
import { Header } from '@/components/Header';
import { WHMCSClient } from '@/lib/whmcs-client';
```

### Routing
Uses Wouter (lightweight router) - routes defined in `App.tsx`:
```tsx
<Route path="/login" component={LoginPage} />
```

### Component Styling
CSS-in-JS via inline `<style>` tags in components. Uses CSS custom properties from `src/styles/global.css` (e.g., `--color-primary`, `--transition-base`).

### Local Dev Proxy
Vite proxies `/api/*` requests to `localhost:8787` (`wrangler dev`) for local testing.

## Important Notes

- **Never commit `.env`** - Use `.env.example` as reference
- **KV binding in `wrangler.jsonc`** is commented out and optional - create a namespace via `wrangler kv namespace create` and uncomment it to record analytics
- **WHMCS API credentials** must be set as Cloudflare secrets for production
- Production domain: `wrld.domains`, served by the Cloudflare Worker (custom domain attached via the `routes` block in `wrangler.jsonc`)
