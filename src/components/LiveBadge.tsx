import { useConfig } from '@/lib/useConfig';

/**
 * "Live availability" beside the hero eyebrow: the search is on and ready.
 * Hollow dot and a plainer label when the Worker isn't reachable and searches
 * go straight to the WHMCS checker instead.
 */
export function LiveBadge() {
  const { config, ready } = useConfig();
  if (!ready) return null;
  const live = config.availability.live;
  return (
    <span className="live-badge" data-state={live ? 'live' : 'fallback'}>
      <span className="live-dot" aria-hidden="true" />
      {live ? 'Live availability' : 'Checks run on WRLD.host'}
    </span>
  );
}
