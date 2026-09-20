/**
 * Every outbound destination in one place. Each URL was checked on
 * 2026-09-20; keep this the single source so a dead link is a one-line fix.
 *
 * Note: wrld.host/tos.php and wrld.host/privacy.php return 404 and
 * support.wrld.tech does not resolve, so legal pages point at wrld.tech and
 * support goes through the WHMCS ticket desk.
 */
export const LINKS = {
  // WRLD.host (WHMCS)
  host: 'https://wrld.host',
  signIn: 'https://wrld.host/login',
  createAccount: 'https://wrld.host/register.php',
  resetPassword: 'https://wrld.host/pwreset.php',
  clientArea: 'https://wrld.host/clientarea.php',
  registerDomain: 'https://wrld.host/cart.php?a=add&domain=register',
  transferDomain: 'https://wrld.host/cart.php?a=add&domain=transfer',
  openTicket: 'https://wrld.host/submitticket.php',
  knowledgeBase: 'https://wrld.host/knowledgebase',
  announcements: 'https://wrld.host/announcements',

  // Other WRLD properties
  status: 'https://status.wrld.tech',
  tech: 'https://wrld.tech',
  about: 'https://wrld.tech/about',
  contact: 'https://wrld.tech/contact',
  terms: 'https://wrld.tech/terms',
  privacy: 'https://wrld.tech/privacy',
  design: 'https://wrld.design',
  email: 'mailto:ridge@wrld.tech',
} as const;

/** WHMCS cart entry for one specific domain. */
export function cartUrl(kind: 'register' | 'transfer', domain: string): string {
  const url = new URL('https://wrld.host/cart.php');
  url.searchParams.set('a', 'add');
  url.searchParams.set('domain', kind);
  url.searchParams.set('query', domain);
  return url.toString();
}
