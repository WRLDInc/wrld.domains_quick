# WRLD.domains Quick Search

A modern, lightning-fast domain search interface built with React, TypeScript, and Cloudflare Workers/Pages. This project integrates with WHMCS at WRLD.host to provide instant domain availability checking and seamless registration.

## Features

- **Lightning-Fast Domain Search**: Instant availability checks for multiple TLDs
- **Modern UI/UX**: Sleek, Texas-tech inspired design with smooth animations
- **WHMCS Integration**: Direct integration with WRLD.host for registration, authentication, and support
- **Analytics**: Backend tracking of domain queries for insights
- **Responsive Design**: Fully responsive across all devices
- **Cloudflare Powered**: Deployed on Cloudflare Pages with Workers for optimal performance

## Tech Stack

- **Frontend**: React 18, TypeScript, Framer Motion
- **Routing**: Wouter (lightweight React router)
- **Build Tool**: Vite
- **Deployment**: Cloudflare Pages + Workers
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
├── functions/               # Cloudflare Functions (API routes)
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
└── wrangler.toml           # Cloudflare configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
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

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Configure your WHMCS API credentials in `.env`:
```env
WHMCS_URL=https://wrld.host
WHMCS_API_IDENTIFIER=your_api_identifier
WHMCS_API_SECRET=your_api_secret
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

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

### Cloudflare Pages Setup

1. **Create KV Namespace**:
```bash
wrangler kv:namespace create "DOMAIN_ANALYTICS"
wrangler kv:namespace create "DOMAIN_ANALYTICS" --preview
```

2. **Update `wrangler.toml`** with the KV namespace IDs returned from the above commands.

3. **Set Secrets**:
```bash
wrangler secret put WHMCS_API_IDENTIFIER
wrangler secret put WHMCS_API_SECRET
```

4. **Deploy to Cloudflare Pages**:
```bash
npm run build
npm run deploy
```

### Cloudflare Dashboard Setup

1. Go to your Cloudflare dashboard
2. Navigate to Pages
3. Create a new project
4. Connect your GitHub repository (WRLDInc/wrld.domains_quick)
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables**: Add your WHMCS credentials

### Domain Configuration

1. Add your custom domain `wrld.domains` in Cloudflare Pages settings
2. Configure DNS:
   - Add a CNAME record: `@` → `wrld-domains-quick.pages.dev`
   - Ensure SSL/TLS is set to "Full" or "Full (strict)"
3. Set up redirect from `www.wrld.domains` to `wrld.domains`:
   - Create a Page Rule or use Cloudflare Redirect Rules

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
