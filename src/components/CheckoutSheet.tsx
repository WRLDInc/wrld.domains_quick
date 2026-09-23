import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PublicConfig } from '@/types/domains';
import { Button } from './Button';
import type { Row } from './SearchResults';
import { cartUrl } from '@/lib/links';
import { formatMoney, startCheckout } from '@/lib/api';
import { trackEvent } from '@/lib/gleap';

interface CheckoutSheetProps {
  row: Row | null;
  config: PublicConfig;
  onClose: () => void;
}

/**
 * The fork in the road for a name direct checkout can sell: pay by card here
 * (Stripe Checkout, registered for you right after payment) or register on
 * WRLD.host alongside hosting. A native <dialog>, so focus trapping, Escape
 * and the backdrop come from the browser; on phones it docks as a bottom sheet.
 */
export function CheckoutSheet({ row, config, onClose }: CheckoutSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (row && !dialog.open) {
      setError(null);
      setBusy(false);
      dialog.showModal();
    } else if (!row && dialog.open) {
      dialog.close();
    }
  }, [row]);

  async function payHere() {
    if (!row) return;
    setBusy(true);
    setError(null);
    trackEvent('domain_action', { domain: row.domain, action: 'checkout_direct' });
    try {
      window.location.assign(await startCheckout(row.domain));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout didn’t start. Try WRLD.host instead.');
      setBusy(false);
    }
  }

  const both = config.checkout.mode === 'both';

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // backdrop click
      }}
    >
      {row ? (
        <div className="sheet-body">
          <div className="sheet-head">
            <div>
              <div className="eyebrow">Register</div>
              <h2 id="sheet-title" className="sheet-title">
                {row.domain}
              </h2>
            </div>
            <button type="button" className="sheet-close" aria-label="Close" onClick={() => ref.current?.close()}>
              <X size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <p className="sheet-price">
            {row.price ? `${formatMoney(row.price.amount, row.price.currency)} for the first year` : 'Priced at checkout'}
          </p>
          <div className="sheet-options">
            <Button variant="warm" size="lg" className="sheet-option" onClick={payHere} disabled={busy}>
              <span>{busy ? 'Opening checkout…' : 'Pay by card and register now'}</span>
              <span aria-hidden="true">→</span>
            </Button>
            <Button
              href={cartUrl('register', row.domain)}
              variant={both ? 'secondary' : 'ghost'}
              size={both ? 'lg' : 'md'}
              className="sheet-option"
              onClick={() => trackEvent('domain_action', { domain: row.domain, action: 'register_whmcs' })}
            >
              <span>Register on WRLD.host with hosting</span>
              <span aria-hidden="true">↗</span>
            </Button>
          </div>
          {error ? (
            <p className="search-notice" role="alert">
              {error}
            </p>
          ) : null}
          <p className="sheet-note">
            Card payments run on Stripe. We register the name in your name as soon as payment clears and email you when
            it’s live. WRLD.host keeps domains, hosting and DNS in one client area.
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
