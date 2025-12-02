# Deployment Guide for WRLD.domains

## Quick Start Checklist

- [ ] GitHub repository created at `github.com/WRLDInc/wrld.domains_quick`
- [ ] WHMCS API credentials obtained
- [ ] Cloudflare account ready
- [ ] Node.js 18+ installed

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure WHMCS API

1. Log into WRLD.host WHMCS admin panel
2. Navigate to: **Setup → Staff Management → API Credentials**
3. Click **Generate New API Credential**
4. Save the **Identifier** and **Secret**
5. Grant the following permissions:
   - DomainWhois
   - GetTLDPricing
   - ValidateLogin
   - GetClientsDetails
   - GetTickets
   - OpenTicket
   - AddClient
   - GetOrders
   - GetInvoices

## Step 3: Create Cloudflare KV Namespace

```bash
# Install Wrangler if not already installed
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv:namespace create "DOMAIN_ANALYTICS"
wrangler kv:namespace create "DOMAIN_ANALYTICS" --preview
```

Copy the IDs returned and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "DOMAIN_ANALYTICS"
id = "YOUR_PRODUCTION_ID"
preview_id = "YOUR_PREVIEW_ID"
```

## Step 4: Set Cloudflare Secrets

```bash
# Set WHMCS API credentials as secrets
wrangler secret put WHMCS_API_IDENTIFIER
# Enter your identifier when prompted

wrangler secret put WHMCS_API_SECRET
# Enter your secret when prompted
```

## Step 5: Test Locally

```bash
# Start development server
npm run dev
```

Visit `http://localhost:3000` to test the application.

## Step 6: Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

## Step 7: Deploy to Cloudflare Pages

### Option A: Using Wrangler CLI

```bash
npm run deploy
```

### Option B: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Pages**
3. Click **Create a project**
4. Select **Connect to Git**
5. Choose your GitHub repository: `WRLDInc/wrld.domains_quick`
6. Configure build settings:
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
7. Add environment variables:
   - `WHMCS_URL`: `https://wrld.host`
   - `ENVIRONMENT`: `production`
8. Click **Save and Deploy**

## Step 8: Configure Custom Domain

1. In Cloudflare Pages project settings, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `wrld.domains`
4. Cloudflare will automatically configure DNS
5. Wait for SSL certificate provisioning (usually < 5 minutes)

### Configure www Redirect

The `public/_redirects` file handles www → non-www redirects automatically.

To verify:
1. Go to your Cloudflare DNS settings
2. Ensure you have:
   - `A` or `CNAME` record for `@` pointing to your Pages project
   - `CNAME` record for `www` pointing to `wrld.domains`

## Step 9: Verify Deployment

1. Visit `https://wrld.domains`
2. Test domain search functionality
3. Check that searches return results
4. Verify "Register" buttons redirect to WRLD.host
5. Test login page integration
6. Submit a test support ticket

## Step 10: Set up GitHub Integration (Optional)

Enable automatic deployments:

1. In Cloudflare Pages settings, ensure GitHub integration is connected
2. Configure branch deployments:
   - **Production**: `main` branch
   - **Preview**: Pull requests
3. Every push to `main` will automatically deploy

## Environment Variables Reference

### Required Secrets (Cloudflare)
```bash
WHMCS_API_IDENTIFIER=your_identifier
WHMCS_API_SECRET=your_secret
```

### Public Variables (wrangler.toml)
```toml
WHMCS_URL=https://wrld.host
ENVIRONMENT=production
```

## Troubleshooting

### Build Fails
- Check Node.js version (requires 18+)
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist .wrangler`

### API Requests Fail
- Verify WHMCS API credentials are correct
- Check WHMCS API IP whitelist settings
- Ensure API permissions are granted
- Check Cloudflare Workers logs for errors

### KV Namespace Issues
- Verify namespace IDs in `wrangler.toml` match created namespaces
- Check bindings are correct: `DOMAIN_ANALYTICS`
- Ensure you're using production namespace ID for production

### Domain Not Resolving
- Wait for DNS propagation (up to 24 hours, usually < 1 hour)
- Verify DNS records in Cloudflare DNS tab
- Check SSL/TLS mode is set to "Full" or "Full (strict)"

### CORS Errors
- Verify WHMCS allows requests from `wrld.domains`
- Check WHMCS admin area CORS settings
- Ensure API credentials have correct permissions

## Performance Monitoring

### Cloudflare Analytics
- View analytics in Cloudflare Dashboard → Pages → Analytics
- Monitor:
  - Page views
  - Requests
  - Data transfer
  - Cache hit ratio

### Workers Analytics
- View in Cloudflare Dashboard → Workers → Analytics
- Monitor:
  - Invocations
  - Success rate
  - CPU time
  - Errors

## Maintenance

### Update Dependencies
```bash
npm update
npm audit fix
```

### Update Wrangler
```bash
npm install -g wrangler@latest
```

### Redeploy
```bash
git push origin main
# Automatic deployment via Cloudflare Pages
```

## Rollback Procedure

If a deployment causes issues:

1. Go to Cloudflare Pages → Deployments
2. Find the last working deployment
3. Click **⋯** (three dots)
4. Select **Rollback to this deployment**

## Security Best Practices

- [ ] Never commit `.env` files to git
- [ ] Rotate WHMCS API credentials regularly
- [ ] Monitor Cloudflare security analytics
- [ ] Keep dependencies updated
- [ ] Review Cloudflare Workers logs for suspicious activity
- [ ] Enable Cloudflare rate limiting if needed

## Support

For deployment issues:
- Check Cloudflare status: https://www.cloudflarestatus.com
- Review build logs in Cloudflare Pages
- Contact WRLD Inc internal support

---

Last updated: 2025-12-02
