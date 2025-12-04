# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

WRLD.domains Quick Search - A React/TypeScript frontend for domain availability checking, deployed on Cloudflare Pages with Workers backend. Integrates with WHMCS at wrld.host for domain registration, authentication, and support ticketing.

## Commands

```bash
# Development
npm run dev              # Start Vite dev server at localhost:3000
npm run cf:dev           # Test with Cloudflare Workers locally (dist + live-reload)

# Build & Deploy
npm run build            # Production build to dist/
npm run preview          # Preview production build
npm run deploy           # Deploy to Cloudflare Pages via Wrangler
npm run type-check       # TypeScript type checking without emit

# Cloudflare Secrets (production)
wrangler secret put WHMCS_API_IDENTIFIER
wrangler secret put WHMCS_API_SECRET
```

## Architecture

### Frontend → Backend → WHMCS Flow
```
React Pages → /api/* (Cloudflare Functions) → WHMCS API (wrld.host)
```

The frontend makes requests to `/api/*` endpoints which are Cloudflare Functions (in `functions/`). These functions use `WHMCSClient` (`src/lib/whmcs-client.ts`) to communicate with the WHMCS installation at wrld.host.

### API Endpoints (Cloudflare Functions)
Functions use the Pages Functions convention - file path determines route:
- `functions/api/domains/check.ts` → `POST /api/domains/check`
- `functions/api/auth/login.ts` → `POST /api/auth/login`
- `functions/api/support/ticket.ts` → `POST /api/support/ticket`

Each function exports `onRequestPost`, `onRequestGet`, etc. and receives `context` with:
- `context.env` - Environment variables and KV bindings
- `context.request` - Request object

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
Vite proxies `/api/*` requests to `localhost:8788` for local Workers testing.

## Important Notes

- **Never commit `.env`** - Use `.env.example` as reference
- **KV namespace IDs in `wrangler.toml`** are placeholders - must be created via `wrangler kv:namespace create`
- **WHMCS API credentials** must be set as Cloudflare secrets for production
- Production domain: `wrld.domains`, served via Cloudflare Pages
