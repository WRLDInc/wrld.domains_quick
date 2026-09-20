declare global {
  /** Bindings available to the Worker. Secrets live in Cloudflare; see wrangler.jsonc. */
  interface CloudflareEnv {
    /** Static assets from dist/ (the `assets.binding` in wrangler.jsonc). */
    ASSETS: Fetcher;
    /** Non-secret var from wrangler.jsonc. */
    WHMCS_URL: string;
    WHMCS_API_IDENTIFIER: string;
    WHMCS_API_SECRET: string;
    ENVIRONMENT?: string;
    /** Optional KV namespace for search analytics. Unbound by default. */
    DOMAIN_ANALYTICS?: KVNamespace;
  }
}

export {};
