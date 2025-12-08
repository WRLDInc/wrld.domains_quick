/**
 * Gleap.io integration helper
 * Widget Key is public and embedded in index.html
 * API Key is stored in 1Password for backend use
 */

// Type declarations for Gleap
declare global {
  interface Window {
    Gleap?: {
      identify: (userId: string, userData?: GleapUserData) => void;
      clearIdentity: () => void;
      track: (eventName: string, eventData?: Record<string, unknown>) => void;
      setCustomData: (key: string, value: string) => void;
      attachCustomData: (data: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
      isOpened: () => boolean;
      showFeedbackButton: (show: boolean) => void;
      setTags: (tags: string[]) => void;
      openHelpCenter: () => void;
      openHelpCenterArticle: (articleId: string) => void;
      startScreenCapture: () => void;
      showSurvey: (surveyId: string) => void;
    };
  }
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

/**
 * Identify a user to Gleap (call after WHMCS login)
 */
export function identifyUser(userId: string, userData?: GleapUserData): void {
  if (window.Gleap) {
    window.Gleap.identify(userId, userData);
  }
}

/**
 * Clear user identity (call on logout)
 */
export function clearIdentity(): void {
  if (window.Gleap) {
    window.Gleap.clearIdentity();
  }
}

/**
 * Track a custom event
 */
export function trackEvent(eventName: string, eventData?: Record<string, unknown>): void {
  if (window.Gleap) {
    window.Gleap.track(eventName, eventData);
  }
}

/**
 * Open Gleap widget
 */
export function openGleap(): void {
  if (window.Gleap) {
    window.Gleap.open();
  }
}

/**
 * Open Gleap help center
 */
export function openHelpCenter(): void {
  if (window.Gleap) {
    window.Gleap.openHelpCenter();
  }
}

/**
 * Set custom data for support context
 */
export function setCustomData(key: string, value: string): void {
  if (window.Gleap) {
    window.Gleap.setCustomData(key, value);
  }
}

export default {
  identifyUser,
  clearIdentity,
  trackEvent,
  openGleap,
  openHelpCenter,
  setCustomData,
};
