import type { PublicConfig, StreamEvent } from '@/types/domains';

/**
 * Browser-side calls to the Worker. Everything here degrades quietly: if the
 * Worker isn't reachable the UI falls back to the WHMCS checker on wrld.host,
 * which stays the source of truth either way.
 */

/** What we assume until /api/config answers (or if it never does). */
export const FALLBACK_CONFIG: PublicConfig = {
  availability: { live: false, providers: [] },
  suggest: { enabled: false, engine: null },
  checkout: { mode: 'whmcs', direct: { enabled: false, provider: null, tlds: [] } },
};

let configPromise: Promise<PublicConfig> | null = null;

/** Fetched once per page load and shared by every caller. */
export function loadConfig(): Promise<PublicConfig> {
  configPromise ??= fetch('/api/config', { headers: { Accept: 'application/json' } })
    .then((res) => (res.ok ? (res.json() as Promise<PublicConfig>) : FALLBACK_CONFIG))
    .catch(() => FALLBACK_CONFIG);
  return configPromise;
}

/**
 * POST a JSON body and read the NDJSON reply, calling `onEvent` for each line
 * as it arrives. Resolves when the stream ends; rejects on network errors or a
 * non-2xx status so the caller can fall back.
 */
export async function streamNdjson(
  url: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
    if (done) break;
  }
  const rest = buffer.trim();
  if (rest) onEvent(JSON.parse(rest) as StreamEvent);
}

/** Start a direct (Stripe) checkout for one domain; resolves to the hosted checkout URL. */
export async function startCheckout(domain: string, years = 1): Promise<string> {
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ domain, years }),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !data.url) throw new Error(data.message ?? `Checkout failed (HTTP ${res.status})`);
  return data.url;
}

/** $12.99 / €9.50 style label for a minor-unit amount. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}
