interface CloudflareEnv {
  WHMCS_URL: string;
  WHMCS_API_IDENTIFIER: string;
  WHMCS_API_SECRET: string;
  ENVIRONMENT: string;
  DOMAIN_ANALYTICS: KVNamespace;
}

declare global {
  interface Window {
    ENV?: {
      WHMCS_URL: string;
    };
  }
}

export {};
