/**
 * The slice of the Stripe API this Worker needs, over fetch: form-encoded
 * requests, custom product IDs, Checkout Sessions, refunds, and webhook
 * signature verification with WebCrypto. Kept dependency-free so the Worker
 * bundle stays small and the logic runs under `node --test` unchanged.
 */

const API = 'https://api.stripe.com/v1';

export class StripeError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.code = code;
  }
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Flatten nested params into Stripe's bracket form: a[b][0][c]=v. Exported for tests. */
export function encodeForm(params: Record<string, FormValue>): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, value: FormValue) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(prefix ? `${prefix}[${k}]` : k, v);
    } else {
      out.append(prefix, String(value));
    }
  };
  walk('', params);
  return out.toString();
}

export interface StripeClient {
  request<T>(method: 'GET' | 'POST', path: string, params?: Record<string, FormValue>, idempotencyKey?: string): Promise<T>;
}

export function stripeClient(secretKey: string, fetcher: typeof fetch = fetch): StripeClient {
  return {
    async request<T>(method: 'GET' | 'POST', path: string, params: Record<string, FormValue> = {}, idempotencyKey?: string) {
      const body = encodeForm(params);
      const url = method === 'GET' && body ? `${API}${path}?${body}` : `${API}${path}`;
      const res = await fetcher(url, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: method === 'POST' ? body : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
      if (!res.ok) throw new StripeError(data.error?.message ?? `Stripe HTTP ${res.status}`, res.status, data.error?.code);
      return data;
    },
  };
}

/** Stripe product IDs may not contain dots: co.uk → wrld_domain_co_uk. */
export function productIdForTld(tld: string): string {
  return `wrld_domain_${tld.replace(/[^a-z0-9]/gi, '_').toLowerCase()}`;
}

const knownProducts = new Set<string>();

/**
 * The "automagic" catalog: one Stripe product per TLD with a stable, custom
 * ID, created the first time that TLD is sold. Prices are passed per session
 * (price_data) because they follow the registrar's live cost.
 */
export async function ensureTldProduct(stripe: StripeClient, tld: string): Promise<string> {
  const id = productIdForTld(tld);
  if (knownProducts.has(id)) return id;
  try {
    await stripe.request('GET', `/products/${id}`);
  } catch (error) {
    if (!(error instanceof StripeError) || error.status !== 404) throw error;
    try {
      await stripe.request(
        'POST',
        '/products',
        {
          id,
          name: `.${tld} domain registration`,
          description: `Registration of a .${tld} domain through WRLD.domains.`,
          metadata: { kind: 'domain_registration', tld, source: 'wrld.domains' },
        },
        `product-${id}`,
      );
    } catch (createError) {
      // Two isolates racing to create the same product: the loser sees "resource_already_exists".
      if (!(createError instanceof StripeError) || createError.code !== 'resource_already_exists') throw createError;
    }
  }
  knownProducts.add(id);
  return id;
}

/** Test hook. */
export function resetProductCache(): void {
  knownProducts.clear();
}

// ---- Webhooks ----------------------------------------------------------------

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(secret: string, timestamp: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)));
}

/**
 * Verify a `Stripe-Signature` header (t=…,v1=…) against the raw body.
 * Rejects stale timestamps (default five minutes) to stop replays.
 */
export async function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  { toleranceSeconds = 300, now = Date.now() }: { toleranceSeconds?: number; now?: number } = {},
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = await signPayload(secret, timestamp, payload);
  return signatures.some((sig) => timingSafeEqual(sig, expected));
}
