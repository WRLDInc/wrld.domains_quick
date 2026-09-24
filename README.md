# WRLD.domains Quick Search

A modern, lightning-fast domain search interface built with React, TypeScript, and Cloudflare Workers/Pages. This project integrates with WHMCS at WRLD.host to provide instant domain availability checking and seamless registration.

## Features

- **Lightning-Fast Domain Search**: Instant availability checks for multiple TLDs
- **Modern UI/UX**: Sleek, Texas-tech inspired design with smooth animations
- **WHMCS Integration**: Direct integration with WRLD.host for registration, authentication, and support
- **Analytics**: Backend tracking of domain queries for insights
- **Responsive Design**: Fully responsive across all devices
- **Cloudflare Powered**: A Cloudflare Worker with Static Assets, built by Workers Builds from GitHub

## Tech Stack

- **Frontend**: React 18, TypeScript, styled with the WRLD design system (https://wrld.design)
- **Routing**: Wouter (lightweight React router)
- **Build Tool**: Vite
- **Deployment**: Cloudflare Workers (static assets + a small API script), via Workers Builds
- **Backend**: Cloudflare Workers (Serverless Functions)
- **Storage**: Cloudflare KV (Analytics)
- **Integration**: WHMCS API

## Project Structure

```
wrld.domains_quick/
├── src/
│   ├── components/          # React components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Hero.tsx
│   │   └── DomainSearch.tsx
│   ├── pages/               # Page components
│   │   ├── Home.tsx
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── Support.tsx
│   ├── lib/                 # Utility libraries
│   │   └── whmcs-client.ts  # WHMCS API client
│   ├── types/               # TypeScript types
│   │   ├── whmcs.ts
│   │   └── env.d.ts
│   ├── styles/              # Global styles
│   │   └── global.css
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── src/worker/              # Worker script: /api/* routes (everything else is a static asset)
│   └── api/
│       ├── domains/
│       │   └── check.ts     # Domain availability check
│       ├── auth/
│       │   └── login.ts     # WHMCS authentication
│       └── support/
│           └── ticket.ts    # Support ticket submission
├── public/                  # Static assets
├── index.html               # HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── wrangler.jsonc          # Cloudflare Worker configuration
```

## Getting Started

### Prerequisites

- Node.js 22.12+ and npm/yarn/pnpm (Vite 8 needs 20.19+ or 22.12+)
- Cloudflare account
- WHMCS instance at WRLD.host with API credentials

### Installation

1. Clone the repository:
```bash
git clone https://github.com/WRLDInc/wrld.domains_quick.git
cd wrld.domains_quick
```

2. Install dependencies:
```bash
npm install
```

3. Create `.dev.vars` from the example. `wrangler dev` reads the Worker's secrets from this file locally (it is git-ignored):
```bash
cp .env.example .dev.vars
```

4. Put your WHMCS API credentials in `.dev.vars`:
```env
WHMCS_URL=https://wrld.host
WHMCS_API_IDENTIFIER=your_api_identifier
WHMCS_API_SECRET=your_api_secret
```

### Development

The inline availability check on the home page calls `/api/domains/check`, a route in the Worker script. Vite proxies `/api/*` to `wrangler dev` on port 8787, so local development needs two processes.

Terminal 1, the Worker (build once first so `dist/` exists; `wrangler dev` reloads the script on change and serves `dist/` as static assets):
```bash
npm run build
npm run cf:dev
```

Terminal 2, the frontend with hot reload:
```bash
npm run dev
```

The app is at `http://localhost:3000`. Searches hit your local Worker, which calls WHMCS with the credentials in `.dev.vars`.

**Testing the fallback on purpose.** If the Worker is unreachable, not configured (no `.dev.vars`, answers 503), or slow, the search form submits straight to the WHMCS cart on wrld.host instead. Running only `npm run dev` exercises exactly that path, and every search will leave the page for wrld.host. That is expected behaviour, not a bug.

Run the request-validation tests for the check endpoint with:
```bash
npm test
```

### Building

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Deployment

The site is a Cloudflare Worker with Static Assets, configured in `wrangler.jsonc`. **Workers Builds** (the Git integration on the Worker) builds every push to `WRLDInc/wrld.domains_quick` with `npm run build` and deploys with `npx wrangler deploy`; `main` is production, other branches get preview versions. The full checklist, including dashboard settings and the custom-domain cutover, is in [DEPLOYMENT.md](DEPLOYMENT.md).

### Runtime configuration (Cloudflare dashboard → the Worker → Settings → Variables and Secrets)

- `WHMCS_API_IDENTIFIER` and `WHMCS_API_SECRET` as secrets. Without them `/api/domains/check` answers 503 and the search falls back to the WHMCS cart.
- `WHMCS_URL` is a plain var set in `wrangler.jsonc`.
- Optional: uncomment the `kv_namespaces` block in `wrangler.jsonc` and bind a namespace to record search analytics for 90 days.

### Continuous integration

`.github/workflows/ci.yml` type-checks, runs the tests, builds, and runs `wrangler deploy --dry-run` on every pull request and push to `main`. It needs no Cloudflare credentials; deploys are Workers Builds' job.

### Manual deploy (fallback)

```bash
npx wrangler login
npm run build
npm run deploy
```

### Domain configuration

`wrld.domains` is attached to the Worker through the `routes` block in `wrangler.jsonc` (commented out until the preview is verified; see DEPLOYMENT.md). `www.wrld.domains` should redirect to the apex with a Cloudflare Redirect Rule on the zone.

## WHMCS API Configuration

### Required WHMCS API Permissions

Ensure your WHMCS API credentials have access to:
- `DomainWhois` - Domain availability checking
- `GetTLDPricing` - Domain pricing information
- `ValidateLogin` - User authentication
- `GetClientsDetails` - Client information
- `GetTickets` - Support tickets
- `OpenTicket` - Create support tickets
- `AddClient` - Client registration
- `GetOrders` - Order information
- `GetInvoices` - Invoice information

### Creating WHMCS API Credentials

1. Log into WHMCS admin area
2. Go to **Setup** → **Staff Management** → **API Credentials**
3. Click **Generate New API Credential**
4. Save the identifier and secret
5. Configure IP restrictions if needed (Cloudflare Workers IPs)

## Environment Variables

### Development (.env)
```env
WHMCS_URL=https://wrld.host
WHMCS_API_IDENTIFIER=your_identifier
WHMCS_API_SECRET=your_secret
ENVIRONMENT=development
```

### Production (Cloudflare Secrets)
Set via Wrangler CLI:
```bash
wrangler secret put WHMCS_API_IDENTIFIER
wrangler secret put WHMCS_API_SECRET
```

## Features & Integrations

### Domain Search
- Real-time availability checking across multiple TLDs
- Live pricing information from WHMCS
- Redirect to WRLD.host for registration

### Authentication
- WHMCS account login
- Session management
- Redirect to WRLD.host client area

### Support System
- Guest ticket submission
- Integration with WHMCS ticketing
- Support resource links

### Analytics
- Domain query tracking via Cloudflare KV
- User agent and country tracking
- 90-day data retention

## Performance Optimization

- Code splitting for optimal loading
- Image optimization
- Cloudflare CDN for global distribution
- Edge computing with Cloudflare Workers
- Minimal dependencies for fast load times

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

This is a private repository for WRLD Inc. For internal development:

1. Create a feature branch
2. Make your changes
3. Submit a pull request
4. Ensure CI/CD passes

## Security

- API credentials stored as Cloudflare secrets
- HTTPS enforced
- CORS configured for WRLD.host integration
- Input validation on all endpoints
- Rate limiting via Cloudflare

## License

Copyright © 2025 WRLD Inc. All rights reserved.

## Support

For issues or questions:
- Open an issue in this repository
- Contact: support@wrld.host
- Visit: https://wrld.host/support

## Related Projects

- [WRLD.host](https://wrld.host) - Main hosting platform
- WRLD Inc Infrastructure projects

---

Built with ❤️ by WRLD Inc
