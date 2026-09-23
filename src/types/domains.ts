/**
 * Types shared by the search UI and the Worker. Kept free of runtime code so
 * both sides (and `node --test`) can import them without pulling anything in.
 */

/**
 * Where an availability answer came from, in the order we trust them.
 * RealtimeRegister is deliberately absent: its acceptable-use policy rules out
 * the REST check call for search traffic, and its sanctioned channel (ADAC)
 * is a follow-up (see DEPLOYMENT.md → Roadmap).
 */
export type ProviderId = 'cloudflare' | 'whmcs' | 'rdap';

/** `unavailable` and `error` keep the original /api/domains/check wire values. */
export type Availability = 'available' | 'unavailable' | 'error';

/** An amount in minor units (cents), so prices never pass through floats. */
export interface Money {
  amount: number;
  currency: string;
}

export interface DomainCheckResult {
  domain: string;
  status: Availability;
  /** The registry prices this name above the standard tier. */
  premium?: boolean;
  /** First-year registration price, when the provider knows it. */
  price?: Money;
  source?: ProviderId;
  message?: string;
}

/** JSON (non-streaming) shape of POST /api/domains/check. */
export interface DomainCheckResponse {
  result: 'success' | 'error';
  domains: DomainCheckResult[];
  message?: string;
}

export interface Suggestion {
  domain: string;
  /** One short line on why the name fits the business. */
  reason: string;
}

/**
 * NDJSON events streamed by /api/domains/check and /api/domains/suggest when
 * the request sends `Accept: application/x-ndjson`. One JSON object per line.
 */
export type StreamEvent =
  | { type: 'start'; domains: string[] }
  | { type: 'suggestions'; engine: string; suggestions: Suggestion[] }
  | { type: 'result'; result: DomainCheckResult }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type CheckoutMode = 'whmcs' | 'direct' | 'both';
export type FulfillmentProvider = 'cloudflare' | 'rtr' | 'whmcs';

/** GET /api/config: what the Worker has switched on, so the UI never guesses. */
export interface PublicConfig {
  availability: { live: boolean; providers: ProviderId[] };
  suggest: { enabled: boolean; engine: string | null };
  checkout: {
    mode: CheckoutMode;
    /** Direct (Stripe) checkout is configured and allowed for these TLDs. Empty means all. */
    direct: { enabled: boolean; provider: FulfillmentProvider | null; tlds: string[] };
  };
}
