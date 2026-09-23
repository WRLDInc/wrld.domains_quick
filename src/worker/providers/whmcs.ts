import { WHMCSClient } from '../../lib/whmcs-client.ts';
import type { WHMCSConfig } from '../../types/whmcs';
import type { AvailabilityProvider } from './types.ts';

/**
 * WHMCS `DomainWhois`: whatever lookup provider WHMCS itself is configured
 * with. One domain per call, and noticeably slower than a registrar API, so it
 * sits behind the registrar providers. Needs WHMCS API credentials and, from
 * a Worker, the `accesskey` bypass (Workers have no fixed egress IP to allowlist).
 */
export function whmcsProvider(config: WHMCSConfig): AvailabilityProvider {
  const client = new WHMCSClient(config);
  return {
    id: 'whmcs',
    batchSize: 1,
    check(domains, signal) {
      return client.checkDomains(domains, signal);
    },
  };
}
