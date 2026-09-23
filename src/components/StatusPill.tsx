import type { DomainCheckResult } from '@/types/domains';

/**
 * checking  lookup in flight
 * available registry-confirmed (Cloudflare or WHMCS)
 * likely    RDAP says unregistered; WRLD.host confirms at checkout
 * premium   available at a registry premium price
 * taken     registered
 * unknown   nobody could answer; WRLD.host checks it
 */
export type PillStatus = 'checking' | 'available' | 'likely' | 'premium' | 'taken' | 'unknown';

const LABELS: Record<PillStatus, string> = {
  checking: 'Checking',
  available: 'Available',
  likely: 'Looks available',
  premium: 'Premium',
  taken: 'Taken',
  unknown: 'Couldn’t check',
};

/** Map an API result onto a pill. Only registrar answers earn a plain "Available". */
export function pillFor(result: DomainCheckResult): PillStatus {
  if (result.status === 'available') {
    if (result.premium) return 'premium';
    return result.source === 'rdap' ? 'likely' : 'available';
  }
  return result.status === 'unavailable' ? 'taken' : 'unknown';
}

/**
 * Status pill after preview/components-badges.html. Colour lives on the dot
 * only; an unknown result renders a hollow dot rather than a guess.
 */
export function StatusPill({ status }: { status: PillStatus }) {
  const cls = status === 'likely' ? 'available pill-likely' : status;
  return (
    <span className={`pill pill-${cls}`}>
      <span className="pill-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
