import { useEffect, useState } from 'react';
import type { PublicConfig } from '@/types/domains';
import { FALLBACK_CONFIG, loadConfig } from './api';

/** The Worker's feature switches (/api/config), with the WHMCS-only fallback until it answers. */
export function useConfig(): { config: PublicConfig; ready: boolean } {
  const [state, setState] = useState<{ config: PublicConfig; ready: boolean }>({ config: FALLBACK_CONFIG, ready: false });
  useEffect(() => {
    let live = true;
    loadConfig().then((config) => {
      if (live) setState({ config, ready: true });
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Direct (Stripe) checkout is on and sells this TLD. */
export function directSells(config: PublicConfig, domain: string): boolean {
  const { direct, mode } = config.checkout;
  if (!direct.enabled || mode === 'whmcs') return false;
  const tld = domain.slice(domain.indexOf('.') + 1);
  return direct.tlds.length === 0 || direct.tlds.includes(tld);
}
