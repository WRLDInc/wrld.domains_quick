/** Shared between the search UI and the Worker that checks availability. */

/**
 * WRLD's standard professional pack, in the weighted order from the ADAC
 * config in Craft (com 1.0 → ai 0.75), then two developer TLDs.
 */
export const POPULAR_TLDS = ['com', 'net', 'co', 'org', 'io', 'ai', 'app', 'dev'] as const;

/** Newer, descriptive extensions offered when a visitor expands the search. */
export const NEW_TLDS = ['tech', 'design', 'digital', 'agency', 'online', 'site', 'store', 'cloud', 'xyz', 'world', 'solutions', 'company'] as const;

/** Full domain: one or more labels, at least one dot, no scheme or path. */
export const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9-]{2,63})+$/;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_PART_RE = /^[a-z0-9-]{2,63}$/;

export interface ParsedDomain {
  /** The part the user is naming, e.g. "acme" in acme.com */
  label: string;
  /** Everything after the first dot, without the leading dot. Null when the user typed no TLD. */
  tld: string | null;
}

/** Trim, lowercase, and strip anything that isn't a bare hostname. */
export function normalizeQuery(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .split(/[/?#\s]/)[0]
    .replace(/^\.+|\.+$/g, '')
    .replace(/^www\.(?=.*\.)/, '');
}

export function parseDomain(query: string): ParsedDomain | null {
  if (!query) return null;
  const parts = query.split('.');
  const label = parts[0];
  if (!LABEL_RE.test(label)) return null;
  if (parts.length === 1) return { label, tld: null };
  const rest = parts.slice(1);
  if (!rest.every((p) => TLD_PART_RE.test(p))) return null;
  return { label, tld: rest.join('.') };
}

/**
 * The domains worth checking for a query: the exact name if a TLD was given,
 * then the same label across the popular TLDs.
 */
export function buildCandidates(parsed: ParsedDomain, max = 8, tlds: readonly string[] = POPULAR_TLDS): string[] {
  const out: string[] = [];
  if (parsed.tld) out.push(`${parsed.label}.${parsed.tld}`);
  for (const tld of tlds) {
    if (out.length >= max) break;
    const domain = `${parsed.label}.${tld}`;
    if (!out.includes(domain)) out.push(domain);
  }
  return out;
}

/** Replace (or add) the TLD on whatever the user has typed so far. */
export function withTld(raw: string, tld: string): string {
  const label = normalizeQuery(raw).split('.')[0];
  return label ? `${label}.${tld}` : '';
}

/** Everything after the first dot ("co.uk" for acme.co.uk), or '' when there is none. */
export function tldOf(domain: string): string {
  const i = domain.indexOf('.');
  return i === -1 ? '' : domain.slice(i + 1);
}

/** A full, checkable domain in canonical lowercase form. */
export function isDomain(value: string): boolean {
  return DOMAIN_RE.test(value);
}
