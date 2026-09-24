// Shared fakes for the Worker tests. Nothing here touches the network.

type Handler = (req: Request) => Response | Promise<Response>;

export interface FakeFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  calls: Request[];
}

/** Route requests by URL prefix or pattern; anything unmatched gets a 599 so tests fail loudly. */
export function fakeFetch(routes: [string | RegExp, Handler][]): FakeFetch {
  const calls: Request[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init) as Request;
    calls.push(req.clone() as Request);
    for (const [pattern, handler] of routes) {
      if (typeof pattern === 'string' ? req.url.startsWith(pattern) : pattern.test(req.url)) return handler(req);
    }
    return new Response(`unrouted: ${req.method} ${req.url}`, { status: 599 });
  }) as FakeFetch;
  fn.calls = calls;
  return fn;
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * In-memory KV that also enforces Cloudflare's limit of one write per second
 * per key (real KV answers a faster second write with a 429), so a handler
 * that writes the same key twice in one request fails here too.
 */
export function fakeKv(): KVNamespace & { store: Map<string, string> } {
  const store = new Map<string, string>();
  const lastWrite = new Map<string, number>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      const now = Date.now();
      const prev = lastWrite.get(key);
      if (prev !== undefined && now - prev < 1000) throw new Error('KV PUT failed: 429 Too Many Requests');
      lastWrite.set(key, now);
      store.set(key, value);
    },
  } as unknown as KVNamespace & { store: Map<string, string> };
}

export const ctx = { waitUntil: (_p: Promise<unknown>) => undefined };

export function baseEnv(overrides: Partial<CloudflareEnv> = {}): CloudflareEnv {
  const assets = { fetch: async (req: Request) => new Response(`asset:${new URL(req.url).pathname}`) };
  return {
    ASSETS: assets as unknown as Fetcher,
    WHMCS_URL: '',
    WHMCS_API_IDENTIFIER: '',
    WHMCS_API_SECRET: '',
    ...overrides,
  };
}

/** A minimal IANA bootstrap: .com/.net at Verisign, .dev at Google. */
export const BOOTSTRAP = {
  services: [
    [['com', 'net'], ['https://rdap.verisign.com/com/v1/']],
    [['dev', 'app'], ['https://pubapi.registry.google/rdap/']],
  ],
};

/** Read an NDJSON response body into events. */
export async function readEvents(res: Response): Promise<{ type: string; [key: string]: unknown }[]> {
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
