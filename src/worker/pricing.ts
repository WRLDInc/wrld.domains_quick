import type { Money } from '../types/domains';

/**
 * Retail pricing for direct (Stripe) checkout: registrar cost plus WRLD's
 * margin. Both knobs are Worker vars so the business side can change them
 * without a deploy of new code:
 *   PRICE_MARKUP_FIXED_CENTS  default 300  (+$3.00, covers Stripe fees)
 *   PRICE_MARKUP_PERCENT      default 0
 * The price shown in search is exactly the price Stripe charges; the cost
 * basis never leaves the Worker.
 */

export interface PricingEnv {
  PRICE_MARKUP_FIXED_CENTS?: string;
  PRICE_MARKUP_PERCENT?: string;
}

export const DEFAULT_MARKUP_CENTS = 300;

function numberVar(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function retailPrice(cost: Money, env: PricingEnv, years = 1): Money {
  const fixed = Math.round(numberVar(env.PRICE_MARKUP_FIXED_CENTS, DEFAULT_MARKUP_CENTS, 0, 100_000));
  const percent = numberVar(env.PRICE_MARKUP_PERCENT, 0, 0, 500);
  const perYear = Math.ceil(cost.amount * (1 + percent / 100)) + fixed;
  return { amount: perYear * years, currency: cost.currency };
}
