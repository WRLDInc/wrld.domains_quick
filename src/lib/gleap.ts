import Gleap from 'gleap';

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

/**
 * Identify a user to Gleap (call after WHMCS login)
 */
export function identifyUser(userId: string, userData?: GleapUserData): void {
  Gleap.identify(userId, userData ?? {});
}

/**
 * Clear user identity (call on logout)
 */
export function clearIdentity(): void {
  Gleap.clearIdentity();
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, eventData?: Record<string, unknown>): void {
  Gleap.trackEvent(eventName, eventData);
}

/**
 * Open Gleap widget
 */
export function openGleap(): void {
  Gleap.open();
}

/**
 * Open Gleap help center
 */
export function openHelpCenter(): void {
  Gleap.openHelpCenter();
}

/**
 * Set custom data for support context
 */
export function setCustomData(key: string, value: string): void {
  Gleap.setCustomData(key, value);
}

export default {
  identifyUser,
  clearIdentity,
  trackEvent,
  openGleap,
  openHelpCenter,
  setCustomData,
};
