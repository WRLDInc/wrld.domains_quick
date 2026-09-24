import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import type { Money, PublicConfig } from '@/types/domains';
import { Button } from './Button';
import { StatusPill, type PillStatus } from './StatusPill';
import { cartUrl } from '@/lib/links';
import { formatMoney } from '@/lib/api';
import { directSells } from '@/lib/useConfig';
import { openDomainWishlist, trackEvent } from '@/lib/gleap';

export interface Row {
  domain: string;
  status: PillStatus;
  price?: Money;
  /** AI suggestions carry a one-line reason. */
  reason?: string;
}

interface SearchResultsProps {
  rows: Row[];
  config: PublicConfig;
  /** Opens the checkout sheet for names direct checkout can sell. */
  onRegister: (row: Row) => void;
  note?: string;
}

function DomainName({ domain }: { domain: string }) {
  const dot = domain.indexOf('.');
  return (
    <span className="result-domain">
      {domain.slice(0, dot)}
      <span className="tld-part">{domain.slice(dot)}</span>
    </span>
  );
}

/**
 * The rows themselves aren't a live region: streaming would re-announce the
 * whole list on every update. Each panel owns one persistent role="status"
 * summary instead.
 */
export function SearchResults({ rows, config, onRegister, note }: SearchResultsProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedDomains = rows.filter((row) => selected.has(row.domain)).map((row) => row.domain);

  function toggle(domain: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  return (
    <div>
      <ul className="results">
        {rows.map((row) => {
          const selectable = row.status === 'available' || row.status === 'likely' || row.status === 'premium';
          return (
          <li key={row.domain} className={`result result-${row.status}`}>
            {selectable ? (
              <label className="result-select" title={`Select ${row.domain} for your wishlist`}>
                <input
                  type="checkbox"
                  checked={selected.has(row.domain)}
                  onChange={() => toggle(row.domain)}
                  aria-label={`Select ${row.domain} for your wishlist`}
                />
              </label>
            ) : (
              <span className="result-select" aria-hidden="true" />
            )}
            <DomainName domain={row.domain} />
            <span className="result-price">{row.price ? `${formatMoney(row.price.amount, row.price.currency)}/yr` : ''}</span>
            <StatusPill status={row.status} />
            <span className="result-action">
              <RowAction row={row} config={config} onRegister={onRegister} />
            </span>
            {row.reason ? <p className="result-reason">{row.reason}</p> : null}
          </li>
          );
        })}
      </ul>
      <div className="result-tools">
        <Button
          type="button"
          variant="secondary"
          disabled={selectedDomains.length === 0}
          onClick={() => openDomainWishlist(selectedDomains, config.wishlist.botId)}
        >
          <BookmarkPlus size={16} strokeWidth={1.5} aria-hidden="true" />
          Save selected to wishlist
        </Button>
        <span className="meta">Select available names, then save them with WRLD Help.</span>
      </div>
      {note ? <p className="meta results-note">{note}</p> : null}
    </div>
  );
}

function RowAction({ row, config, onRegister }: { row: Row; config: PublicConfig; onRegister: (row: Row) => void }) {
  const track = (action: string) => () => trackEvent('domain_action', { domain: row.domain, action, status: row.status });

  switch (row.status) {
    case 'available':
      if (row.price && directSells(config, row.domain)) {
        return (
          <Button variant="warm" size="sm" onClick={() => onRegister(row)}>
            Register
          </Button>
        );
      }
      return (
        <Button href={cartUrl('register', row.domain)} variant="warm" size="sm" onClick={track('register_whmcs')}>
          Register <span className="arrow" aria-hidden="true">↗</span>
        </Button>
      );
    case 'likely':
      // RDAP can't see reserved or premium names, so WHMCS checks (and prices) it before it reaches the cart.
      return (
        <Button href={cartUrl('register', row.domain, { lookup: true })} variant="warm" size="sm" onClick={track('register_whmcs_lookup')}>
          Register <span className="arrow" aria-hidden="true">↗</span>
        </Button>
      );
    case 'premium':
      return (
        <a className="result-link" href={cartUrl('register', row.domain, { lookup: true })} onClick={track('premium_whmcs')}>
          See premium price ↗
        </a>
      );
    case 'taken':
      return (
        <a className="result-link" href={cartUrl('transfer', row.domain)} onClick={track('transfer_whmcs')}>
          Yours already? Transfer it ↗
        </a>
      );
    case 'unknown':
      return (
        <a className="result-link" href={cartUrl('register', row.domain, { lookup: true })} onClick={track('check_whmcs')}>
          Check on WRLD.host ↗
        </a>
      );
    default:
      return null;
  }
}
