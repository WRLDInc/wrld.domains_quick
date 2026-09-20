export type PillStatus = 'checking' | 'available' | 'taken' | 'unknown';

const LABELS: Record<PillStatus, string> = {
  checking: 'Checking',
  available: 'Available',
  taken: 'Taken',
  unknown: 'Couldn’t check',
};

/**
 * Status pill after preview/components-badges.html. Colour lives on the dot
 * only; an unknown result renders a hollow dot rather than a guess.
 */
export function StatusPill({ status }: { status: PillStatus }) {
  return (
    <span className={`pill pill-${status}`}>
      <span className="pill-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
