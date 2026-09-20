/**
 * Gleap (WRLD Help) is loaded by the snippet in index.html, which matches the
 * install on wrld.host. Before the SDK arrives, window.Gleap is a queue that
 * records calls and replays them, so every helper below is safe to call at
 * any point after page load.
 */

type GleapLike = {
  open?: () => void;
  openHelpCenter?: (showBackButton?: boolean) => void;
  openConversations?: () => void;
  identify?: (userId: string, data?: object) => void;
  clearIdentity?: () => void;
  trackEvent?: (name: string, data?: Record<string, unknown>) => void;
  setCustomData?: (key: string, value: string) => void;
};

function gleap(): GleapLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as Window & { Gleap?: GleapLike }).Gleap;
}

export interface GleapUserData {
  name?: string;
  email?: string;
  phone?: string;
  value?: number;
  plan?: string;
  companyId?: string;
  companyName?: string;
  customData?: Record<string, unknown>;
}

/** Identify a user to Gleap (after a WHMCS sign-in). */
export function identifyUser(userId: string, userData?: GleapUserData): void {
  gleap()?.identify?.(userId, userData ?? {});
}

/** Clear the identity (on sign-out). */
export function clearIdentity(): void {
  gleap()?.clearIdentity?.();
}

export function trackEvent(eventName: string, eventData?: Record<string, unknown>): void {
  gleap()?.trackEvent?.(eventName, eventData);
}

/** Open the chat. */
export function openGleap(): void {
  gleap()?.open?.();
}

export function openHelpCenter(): void {
  gleap()?.openHelpCenter?.();
}

export function setCustomData(key: string, value: string): void {
  gleap()?.setCustomData?.(key, value);
}
