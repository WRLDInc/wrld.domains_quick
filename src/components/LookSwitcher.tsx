import { LOOKS, LOOK_LABELS, isReviewing, setLook, useLook } from '@/lib/look';

/**
 * Reviewer-only toggle between the three search-button treatments. Renders
 * only when the URL carries ?look= or ?review, so visitors never see it.
 */
export function LookSwitcher() {
  const look = useLook();
  if (!isReviewing()) return null;
  return (
    <div className="look-switcher" role="group" aria-label="Search button look (review only)">
      <span>Look</span>
      {LOOKS.map((option) => (
        <button key={option} type="button" aria-pressed={look === option} onClick={() => setLook(option)}>
          {LOOK_LABELS[option]}
        </button>
      ))}
    </div>
  );
}
