/** Shared between the search UI and the Pages Function that checks availability. */

export const POPULAR_TLDS = ['com', 'net', 'org', 'io', 'dev', 'app', 'tech', 'ai'] as const;

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
    .replace(/^www\.(?=.*\.)/, '')
    .split(/[/?#\s]/)[0]
    .replace(/^\.+|\.+$/g, '');
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
export function buildCandidates(parsed: ParsedDomain, max = 8): string[] {
  const out: string[] = [];
  if (parsed.tld) out.push(`${parsed.label}.${parsed.tld}`);
  for (const tld of POPULAR_TLDS) {
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
