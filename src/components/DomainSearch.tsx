import { useId, useRef, useState, type FormEvent } from 'react';
import { Button } from './Button';
import { StatusPill, type PillStatus } from './StatusPill';
import { RollText } from './RollText';
import { LINKS, cartUrl } from '@/lib/links';
import { POPULAR_TLDS, buildCandidates, normalizeQuery, parseDomain, withTld } from '@/lib/domains';
import type { DomainCheckResponse } from '@/types/whmcs';

interface Row {
  domain: string;
  status: PillStatus;
}

const CHECK_TIMEOUT_MS = 12_000;

/**
 * Domain search with progressive enhancement.
 *
 * The form itself is a plain GET to the WHMCS cart on wrld.host, so it works
 * with JavaScript off. With JavaScript on, submit calls /api/domains/check
 * (a Pages Function in front of WHMCS DomainWhois) and renders availability
 * inline. If that call fails for any reason the form falls through to WHMCS,
 * which is the source of truth either way.
 */
export function DomainSearch() {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const normalized = normalizeQuery(query);
  const activeTld = parseDomain(normalized)?.tld ?? null;

  function pickTld(tld: string) {
    setQuery(withTld(query, tld));
    setNotice(null);
    inputRef.current?.focus();
  }

  /** Hand the query to WHMCS's own checker (the same path the no-JS form takes). */
  function fallbackToWhmcs() {
    if (inputRef.current) inputRef.current.value = normalized || query.trim();
    formRef.current?.submit();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseDomain(normalized);
    if (!parsed) {
      setNotice('Enter a domain name, like example.com.');
      return;
    }

    const candidates = buildCandidates(parsed);
    setNotice(null);
    setBusy(true);
    setRows(candidates.map((domain) => ({ domain, status: 'checking' })));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const res = await fetch('/api/domains/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: candidates }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DomainCheckResponse;
      if (data.result !== 'success') throw new Error(data.message ?? 'Check failed');

      setRows(
        candidates.map((domain) => {
          const hit = data.domains.find((d) => d.domain === domain);
          const status: PillStatus =
            hit?.status === 'available' ? 'available' : hit?.status === 'unavailable' ? 'taken' : 'unknown';
          return { domain, status };
        }),
      );
    } catch {
      fallbackToWhmcs();
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  return (
    <div className="search">
      <form
        ref={formRef}
        className="search-form"
        action="https://wrld.host/cart.php"
        method="get"
        role="search"
        aria-label="Domain search"
        onSubmit={onSubmit}
      >
        <input type="hidden" name="a" value="add" />
        <input type="hidden" name="domain" value="register" />

        <label htmlFor={`${id}-query`} className="sr-only">
          Domain name
        </label>
        <div className="search-bar">
          <input
            ref={inputRef}
            id={`${id}-query`}
            name="query"
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (notice) setNotice(null);
            }}
            placeholder="yourname.com"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            enterKeyHint="search"
          />
          <Button type="submit" variant="warm" size="lg" disabled={busy || normalized.length === 0}>
            <RollText>{busy ? 'Checking…' : 'Search'}</RollText>
          </Button>
        </div>

        {notice ? (
          <p className="search-notice" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="search-tlds" role="group" aria-label="Popular TLDs">
          <span className="meta">Try</span>
          {POPULAR_TLDS.map((tld) => (
            <button
              key={tld}
              type="button"
              className="tld"
              aria-pressed={activeTld === tld}
              onClick={() => pickTld(tld)}
            >
              .{tld}
            </button>
          ))}
        </div>

        <div className="search-foot">
          <span>
            Already own it?{' '}
            <a href={LINKS.transferDomain}>
              Transfer it to WRLD.host <span className="arrow" aria-hidden="true">↗</span>
            </a>
          </span>
          <a href={LINKS.registerDomain}>
            Search on WRLD.host instead <span className="arrow" aria-hidden="true">↗</span>
          </a>
        </div>
      </form>

      {rows ? (
        <div aria-live="polite">
          <ul className="results">
            {rows.map((row) => (
              <li key={row.domain} className="result">
                <span className="result-domain">{row.domain}</span>
                <StatusPill status={row.status} />
                <span className="result-action">{renderAction(row)}</span>
              </li>
            ))}
          </ul>
          <p className="meta results-note">
            Availability is checked live through WRLD.host. Pricing and terms show at checkout.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function renderAction(row: Row) {
  switch (row.status) {
    case 'available':
      return (
        <Button href={cartUrl('register', row.domain)} variant="warm" size="sm">
          Register <span className="arrow" aria-hidden="true">↗</span>
        </Button>
      );
    case 'taken':
      return (
        <a className="result-link" href={cartUrl('transfer', row.domain)}>
          Yours already? Transfer it ↗
        </a>
      );
    case 'unknown':
      return (
        <a className="result-link" href={cartUrl('register', row.domain)}>
          Check on WRLD.host ↗
        </a>
      );
    default:
      return null;
  }
}
