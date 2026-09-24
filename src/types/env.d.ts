declare global {
  /**
   * Bindings available to the Worker. Every integration is optional and turns
   * on only when its credentials are present, so a bare deploy still searches
   * (RDAP) and still sells (WHMCS cart handoff). See wrangler.jsonc and
   * DEPLOYMENT.md for which are vars and which are secrets.
   */
  interface CloudflareEnv {
    /** Static assets from dist/ (the `assets.binding` in wrangler.jsonc). */
    ASSETS: Fetcher;
    ENVIRONMENT?: string;
    /** Public origin used for Stripe return URLs. Defaults to https://wrld.domains. */
    SITE_URL?: string;

    // ---- Availability providers --------------------------------------------
    /** Comma-separated provider order. Default "cloudflare,whmcs,rdap"; unconfigured ones are skipped. */
    DOMAIN_PROVIDERS?: string;

    /** WHMCS (wrld.host). WHMCS_URL is a var; the rest are secrets. */
    WHMCS_URL: string;
    WHMCS_API_IDENTIFIER: string;
    WHMCS_API_SECRET: string;
    /** `$api_access_key` from configuration.php; bypasses the API IP allowlist. */
    WHMCS_API_ACCESS_KEY?: string;

    /** Cloudflare Registrar API (beta). Token needs Registrar read (+ write for direct sales). */
    CF_ACCOUNT_ID?: string;
    CF_REGISTRAR_API_TOKEN?: string;
    /** "true" → registrar-sandbox endpoints (com/net only, no billing). */
    CF_REGISTRAR_SANDBOX?: string;

    // ---- AI suggestions ----------------------------------------------------
    /** "claude" | "workers-ai" | "auto" (default: Claude when a key is set, else Workers AI) | "wordplay" (local dev). */
    SUGGEST_ENGINE?: string;
    ANTHROPIC_API_KEY?: string;
    /** Claude model override; defaults to the model pinned in src/worker/suggest.ts. */
    SUGGEST_MODEL?: string;
    /** Workers AI binding (`ai.binding` in wrangler.jsonc). */
    AI?: Ai;
    /** Workers AI model override. */
    WORKERS_AI_MODEL?: string;

    // ---- Checkout ------------------------------------------------------------
    /** "whmcs" (default) | "direct" | "both". */
    CHECKOUT_MODE?: string;
    /** Optional comma list of TLDs allowed through direct checkout; empty = every TLD the registrar sells. */
    DIRECT_TLDS?: string;
    /** Who registers direct orders. Only "cloudflare" is implemented today. */
    FULFILLMENT_PROVIDER?: string;
    /** Must be exactly "true" before a paid order calls a registrar. Anything else is a dry run. */
    REGISTRAR_LIVE?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    PRICE_MARKUP_FIXED_CENTS?: string;
    PRICE_MARKUP_PERCENT?: string;
    /** Optional Slack-compatible incoming webhook for order notifications. */
    ORDER_WEBHOOK_URL?: string;
    /** Order records (idempotency + status). Required for direct checkout. */
    ORDERS?: KVNamespace;

    // ---- Abuse controls & analytics -----------------------------------------
    /** Workers Rate Limiting bindings (`ratelimits` in wrangler.jsonc). */
    SEARCH_LIMITER?: RateLimit;
    SUGGEST_LIMITER?: RateLimit;
    /** Optional KV namespace for search analytics. Unbound by default. */
    DOMAIN_ANALYTICS?: KVNamespace;
  }
}

export {};
