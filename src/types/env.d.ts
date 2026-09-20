declare global {
  /** Bindings available to Pages Functions. Secrets live in Cloudflare; see wrangler.toml. */
  interface CloudflareEnv {
    WHMCS_URL: string;
    WHMCS_API_IDENTIFIER: string;
    WHMCS_API_SECRET: string;
    ENVIRONMENT?: string;
    /** Optional KV namespace for search analytics. Unbound by default. */
    DOMAIN_ANALYTICS?: KVNamespace;
  }
}

export {};
