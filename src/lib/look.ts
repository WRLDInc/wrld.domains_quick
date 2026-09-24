import { useSyncExternalStore } from 'react';

/**
 * The three candidate "big button" treatments for the search console. The
 * choice rides on ?look= so a reviewer can flip between them on a preview
 * deployment; everyone else gets the default. Once one is picked, delete the
 * other two blocks in global.css and this module.
 */
export const LOOKS = ['beacon', 'button', 'command'] as const;
export type SearchLook = (typeof LOOKS)[number];
export const DEFAULT_LOOK: SearchLook = 'beacon';

export const LOOK_LABELS: Record<SearchLook, string> = {
  beacon: 'Beacon',
  button: 'Big button',
  command: 'Command',
};

function read(): SearchLook {
  if (typeof window === 'undefined') return DEFAULT_LOOK;
  const value = new URLSearchParams(window.location.search).get('look');
  return (LOOKS as readonly string[]).includes(value ?? '') ? (value as SearchLook) : DEFAULT_LOOK;
}

const listeners = new Set<() => void>();

export function setLook(look: SearchLook): void {
  const url = new URL(window.location.href);
  url.searchParams.set('look', look);
  window.history.replaceState(window.history.state, '', url);
  listeners.forEach((fn) => fn());
}

export function useLook(): SearchLook {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => DEFAULT_LOOK,
  );
}

/** Reviewer mode: the switcher shows when ?look= or ?review is in the URL. */
export function isReviewing(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('look') || params.has('review');
}
