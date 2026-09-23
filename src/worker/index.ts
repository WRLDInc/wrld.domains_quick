/**
 * Worker entry. Only /api/* reaches this script (see `run_worker_first` in
 * wrangler.jsonc); every other request is served from the static assets in
 * dist/, with unmatched paths falling back to index.html for the SPA router.
 */
import { handleDomainCheck } from './domains-check.ts';
import { handleSuggest } from './suggest.ts';
import { handleCheckoutStatus, handleCreateCheckout, handleStripeWebhook } from './checkout.ts';
import { publicConfig } from './config.ts';
import { json } from './http.ts';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case '/api/domains/check':
        return handleDomainCheck(request, env, ctx);
      case '/api/domains/suggest':
        return handleSuggest(request, env, ctx);
      case '/api/config':
        // Feature switches only, no secrets. A minute of caching is plenty.
        return json(publicConfig(env), 200, { 'Cache-Control': 'public, max-age=60' });
      case '/api/checkout':
        return handleCreateCheckout(request, env);
      case '/api/checkout/status':
        return handleCheckoutStatus(request, env);
      case '/api/stripe/webhook':
        return handleStripeWebhook(request, env, ctx);
    }

    if (pathname.startsWith('/api/')) {
      return json({ result: 'error', message: 'No such endpoint.' }, 404);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<CloudflareEnv>;
