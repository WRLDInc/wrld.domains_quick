import type { StreamEvent } from '../types/domains';

/** Small HTTP helpers shared by the Worker routes. */

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...BASE_HEADERS, ...extra },
  });
}

export function wantsNdjson(request: Request): boolean {
  return (request.headers.get('Accept') ?? '').includes('application/x-ndjson');
}

/**
 * Stream NDJSON: the producer gets `send` and runs after the Response has
 * been returned, so rows reach the browser as each lookup lands. Errors inside
 * the producer become a final `error` event instead of a broken stream.
 */
export function ndjson(
  producer: (send: (event: StreamEvent) => void) => Promise<void>,
  waitUntil: (p: Promise<unknown>) => void,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let open = true;
  const send = (event: StreamEvent) => {
    if (!open) return;
    writer.write(encoder.encode(`${JSON.stringify(event)}\n`)).catch(() => {
      open = false; // the client went away
    });
  };

  const run = (async () => {
    try {
      await producer(send);
    } catch (error) {
      console.error('Stream producer failed:', error);
      send({ type: 'error', message: 'Something went wrong while checking. Try again in a moment.' });
    } finally {
      open = false;
      await writer.close().catch(() => undefined);
    }
  })();
  waitUntil(run);

  return new Response(readable, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', ...BASE_HEADERS },
  });
}

/**
 * Read the body as text, giving up as soon as it passes `maxBytes` rather
 * than buffering everything first (a missing Content-Length can't bypass the
 * cap). Null when the body is too large or unreadable.
 */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > maxBytes) return null;
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Parse a JSON object body (≤ 16 KB). Null for anything else, so routes can 400 cleanly. */
export async function readJsonObject(request: Request, maxBytes = 16_384): Promise<Record<string, unknown> | null> {
  const text = await readLimitedText(request, maxBytes);
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'unknown';
}

/**
 * Workers Rate Limiting binding when present (wrangler.jsonc `ratelimits`);
 * without it (local dev, tests) every request is allowed.
 */
export async function allowRequest(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key });
    return success;
  } catch (error) {
    console.error('Rate limiter failed open:', error);
    return true;
  }
}

export function tooMany(): Response {
  return json({ result: 'error', message: 'Too many searches in a short time. Give it a few seconds.' }, 429, {
    'Retry-After': '10',
  });
}
