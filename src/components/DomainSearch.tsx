import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowRight, CircleHelp, ListPlus, Sparkles } from 'lucide-react';
import type { DomainCheckResult, PublicConfig } from '@/types/domains';
import { Button } from './Button';
import { RollText } from './RollText';
import { SearchResults, type Row } from './SearchResults';
import { CheckoutSheet } from './CheckoutSheet';
import { pillFor, type PillStatus } from './StatusPill';
import { LINKS } from '@/lib/links';
import { NEW_TLDS, POPULAR_TLDS, buildCandidates, normalizeQuery, parseDomain, withTld } from '@/lib/domains';
import { streamNdjson } from '@/lib/api';
import { useConfig } from '@/lib/useConfig';
import { useLook } from '@/lib/look';
import { trackEvent } from '@/lib/gleap';

type Mode = 'name' | 'ai';

const TYPING_DEBOUNCE_MS = 450;
const CHECK_TIMEOUT_MS = 15_000;
const SUGGEST_TIMEOUT_MS = 45_000;

const EXAMPLES = [
  'Family-owned HVAC company in Plano, TX. Fast emergency repairs.',
  'Pediatric dental practice in Garland opening a second office.',
  'Food truck selling smoked brisket tacos around Austin.',
  'Bookkeeping and CFO services for construction companies.',
];

const ORDER: Record<PillStatus, number> = { available: 0, likely: 1, premium: 2, checking: 3, unknown: 4, taken: 5 };
const ALL_TLDS = [...POPULAR_TLDS, ...NEW_TLDS];

function sortRows(rows: Row[] | null): Row[] | null {
  const settled = settle(rows);
  return settled ? [...settled].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : settled;
}

function toRow(result: DomainCheckResult, prev?: Row): Row {
  return { domain: result.domain, status: pillFor(result), price: result.price, reason: prev?.reason };
}

function applyResult(rows: Row[] | null, result: DomainCheckResult): Row[] | null {
  return rows?.map((r) => (r.domain === result.domain ? toRow(result, r) : r)) ?? null;
}

function settle(rows: Row[] | null): Row[] | null {
  return rows?.map((r) => (r.status === 'checking' ? { ...r, status: 'unknown' as const } : r)) ?? null;
}

function engineName(label: string | null): string {
  if (!label) return '';
  if (label.startsWith('claude')) return 'Claude';
  if (label.startsWith('workers-ai')) return 'Workers AI';
  return 'WRLD wordplay';
}

function InfoTip({ children }: { children: string }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={children}>
      <CircleHelp size={15} strokeWidth={1.5} aria-hidden="true" />
      <span className="info-tip-content" role="tooltip">
        {children}
      </span>
    </span>
  );
}

/**
 * The hero search console. Two modes share one surface: search a name (live
 * as you type, streamed row by row) or describe the business and let AI
 * propose names that are checked before they're shown.
 *
 * Progressive enhancement: the name form is a plain GET to the WHMCS cart on
 * wrld.host, so it works with JavaScript off, and any failure of the Worker
 * falls through to that same path. WHMCS stays the source of truth.
 */
export function DomainSearch() {
  const id = useId();
  const look = useLook();
  const { config, ready } = useConfig();
  const [mode, setMode] = useState<Mode>('name');
  const [busy, setBusy] = useState(false);
  const [checkoutRow, setCheckoutRow] = useState<Row | null>(null);
  // Bumped only when the AI tab is clicked or tapped, so its textarea takes
  // focus then, but arrow-key tab switching leaves focus on the tab.
  const [aiFocus, setAiFocus] = useState(0);
  const tabs = useRef<Record<Mode, HTMLButtonElement | null>>({ name: null, ai: null });
  const aiEnabled = config.suggest.enabled;

  function openAi() {
    setMode('ai');
    setAiFocus((n) => n + 1);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next: Mode = mode === 'name' ? 'ai' : 'name';
    setMode(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="search" data-look={look} data-busy={busy ? 'true' : undefined}>
      {aiEnabled ? (
        <div className="search-modes" role="tablist" aria-label="How do you want to search?">
          <button
            ref={(el) => {
              tabs.current.name = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-name`}
            className="search-mode"
            aria-selected={mode === 'name'}
            aria-controls={`${id}-panel-name`}
            tabIndex={mode === 'name' ? 0 : -1}
            onClick={() => setMode('name')}
            onKeyDown={onTabKey}
          >
            Search a name
          </button>
          <button
            ref={(el) => {
              tabs.current.ai = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-ai`}
            className="search-mode"
            aria-selected={mode === 'ai'}
            aria-controls={`${id}-panel-ai`}
            tabIndex={mode === 'ai' ? 0 : -1}
            onClick={openAi}
            onKeyDown={onTabKey}
          >
            {/* Small phones show "Describe"; the accessible name stays "Describe your business AI",
                which still starts with the visible text (WCAG 2.5.3). */}
            <span>
              Describe<span className="mode-extra"> your business</span>
            </span>
            <span className="mode-badge" aria-hidden="true">New</span>
            <span className="sr-only"> AI</span>
          </button>
        </div>
      ) : null}

      <div
        id={`${id}-panel-name`}
        role={aiEnabled ? 'tabpanel' : undefined}
        aria-labelledby={aiEnabled ? `${id}-tab-name` : undefined}
        hidden={mode !== 'name'}
      >
        <NameSearch
          id={id}
          config={config}
          ready={ready}
          active={mode === 'name'}
          aiEnabled={aiEnabled}
          onBusy={setBusy}
          onRegister={setCheckoutRow}
          onExpandAi={openAi}
        />
      </div>
      {aiEnabled ? (
        <div id={`${id}-panel-ai`} role="tabpanel" aria-labelledby={`${id}-tab-ai`} hidden={mode !== 'ai'}>
          <AiSearch id={id} config={config} active={mode === 'ai'} focusToken={aiFocus} onBusy={setBusy} onRegister={setCheckoutRow} />
        </div>
      ) : null}

      <CheckoutSheet row={checkoutRow} config={config} onClose={() => setCheckoutRow(null)} />
    </div>
  );
}

interface PanelProps {
  id: string;
  config: PublicConfig;
  active: boolean;
  onBusy: (busy: boolean) => void;
  onRegister: (row: Row) => void;
}

/**
 * ?q= and ?cancelled= prefill the search. Both are accepted only when they
 * parse as a domain name, so a crafted link can't put arbitrary text in the
 * alert on a WRLD page.
 */
function initialQuery(): { query: string; notice: string | null } {
  if (typeof window === 'undefined') return { query: '', notice: null };
  const params = new URLSearchParams(window.location.search);
  const clean = (value: string | null) => {
    const normalized = normalizeQuery((value ?? '').slice(0, 253));
    return parseDomain(normalized) ? normalized : '';
  };
  const cancelled = clean(params.get('cancelled'));
  if (cancelled && parseDomain(cancelled)?.tld) {
    return { query: cancelled, notice: `Checkout cancelled. ${cancelled} is still here when you’re ready.` };
  }
  return { query: clean(params.get('q')), notice: null };
}

/** One sentence for the persistent status region once a check settles. */
function summarize(rows: Row[]): string {
  const open = rows.filter((r) => r.status === 'available' || r.status === 'likely' || r.status === 'premium').length;
  const unchecked = rows.filter((r) => r.status === 'unknown').length;
  const tail = unchecked ? ` ${unchecked} couldn’t be checked here.` : '';
  return `${open} of ${rows.length} names look open.${tail}`;
}

function NameSearch({
  id,
  config,
  ready,
  active,
  aiEnabled,
  onBusy,
  onRegister,
  onExpandAi,
}: PanelProps & { ready: boolean; aiEnabled: boolean; onExpandAi: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [initial] = useState(initialQuery);
  const [query, setQuery] = useState(initial.query);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(initial.notice);
  const [expanded, setExpanded] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queryRef = useRef(query);
  queryRef.current = query;

  const normalized = normalizeQuery(query);
  const activeTld = parseDomain(normalized)?.tld ?? null;
  const live = config.availability.live;

  useEffect(() => {
    if (active) onBusy(busy);
  }, [active, busy, onBusy]);

  // Leaving the page cancels whatever is in flight.
  useEffect(
    () => () => {
      clearTimeout(typingTimer.current);
      controllerRef.current?.abort();
    },
    [],
  );

  /** Hand the query to WHMCS's own checker (the same path the no-JS form takes). */
  const fallbackToWhmcs = useCallback(() => {
    if (inputRef.current) inputRef.current.value = normalizeQuery(queryRef.current) || queryRef.current.trim();
    formRef.current?.submit();
  }, []);

  const runCheck = useCallback(
    async (kind: 'typing' | 'submit' | 'expand', includeNewTlds = false) => {
      const parsed = parseDomain(normalizeQuery(queryRef.current));
      if (!parsed) {
        if (kind === 'submit') setNotice('That doesn’t look like a domain yet. Try something like yourbusiness.com.');
        return;
      }
      const candidates = buildCandidates(parsed, includeNewTlds ? 20 : 8, includeNewTlds ? ALL_TLDS : POPULAR_TLDS);
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      // Typing already clears notices in onChange; an automatic check (e.g. the
      // ?cancelled= prefill) must not wipe the notice that explains it.
      if (kind === 'submit') setNotice(null);
      setBusy(true);
      setRows((prev) =>
        candidates.map((domain) => prev?.find((r) => r.domain === domain && r.status !== 'checking') ?? { domain, status: 'checking' }),
      );
      if (kind === 'submit') trackEvent('domain_search', { label: parsed.label, tld: parsed.tld });
      if (kind === 'expand') trackEvent('domain_search_expanded', { label: parsed.label, kind: 'new_tlds' });

      try {
        await streamNdjson(
          '/api/domains/check',
          { domains: candidates },
          (event) => {
            if (event.type === 'result') setRows((prev) => applyResult(prev, event.result));
            else if (event.type === 'error') throw new Error(event.message);
          },
          controller.signal,
        );
        setRows(sortRows);
      } catch {
        if (controllerRef.current !== controller) return; // superseded by a newer keystroke
        if (kind === 'submit') fallbackToWhmcs();
        else setRows(settle);
      } finally {
        clearTimeout(timer);
        if (controllerRef.current === controller) setBusy(false);
      }
    },
    [fallbackToWhmcs],
  );

  // Live as you type: debounced, and only once /api/config says we're live.
  useEffect(() => {
    if (!ready || !live) return;
    const parsed = parseDomain(normalized);
    if (!parsed) {
      if (!normalized) {
        controllerRef.current?.abort();
        setRows(null);
      }
      return;
    }
    if (parsed.label.length < 2) return;
    typingTimer.current = setTimeout(() => runCheck('typing'), TYPING_DEBOUNCE_MS);
    return () => clearTimeout(typingTimer.current);
  }, [normalized, ready, live, runCheck]);

  // "/" focuses the search from anywhere on the page.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A pending as-you-type check would otherwise fire after this submit and
    // abort it, taking the WHMCS fallback with it.
    clearTimeout(typingTimer.current);
    if (!normalized) {
      setNotice('Type a name first, like yourbusiness.com.');
      inputRef.current?.focus();
      return;
    }
    if (ready && !live) {
      fallbackToWhmcs();
      return;
    }
    void runCheck('submit');
  }

  function pickTld(tld: string) {
    setQuery(withTld(query, tld));
    setNotice(null);
    inputRef.current?.focus();
  }

  return (
    <>
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
        <div className="search-bar search-bar-animated">
          <input
            ref={inputRef}
            id={`${id}-query`}
            name="query"
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setExpanded(false);
              if (notice) setNotice(null);
            }}
            placeholder="yourbusiness.com"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="url"
            enterKeyHint="search"
          />
          <span className="kbd" aria-hidden="true">
            /
          </span>
          <Button
            type="submit"
            variant="warm"
            className={`btn-xl search-go${normalized.length >= 5 ? ' search-go-ready' : ''}`}
            aria-label={busy ? 'Checking' : 'Search domains'}
          >
            <RollText>{busy ? 'Checking…' : 'Search'}</RollText>
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
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
            <button key={tld} type="button" className="tld" aria-pressed={activeTld === tld} onClick={() => pickTld(tld)}>
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

      {/* Always rendered so screen readers pick up the first summary too. */}
      <p className="sr-only" role="status">
        {rows && !busy ? summarize(rows) : ''}
      </p>

      {rows ? (
        <>
          <SearchResults
            rows={rows}
            config={config}
            onRegister={onRegister}
            note="Available names are shown first. “Looks available” is confirmed by WRLD.host at checkout."
          />
          <div className="search-expansions">
            {!expanded ? (
              <span className="expansion-action">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setExpanded(true);
                    void runCheck('expand', true);
                  }}
                >
                  <ListPlus size={16} strokeWidth={1.5} aria-hidden="true" />
                  Load more TLDs
                </Button>
                <InfoTip>
                  New TLDs are newer, descriptive domain endings such as .design, .agency, and .store.
                </InfoTip>
              </span>
            ) : null}
            {aiEnabled ? (
              <span className="expansion-action">
                <Button type="button" variant="secondary" onClick={onExpandAi}>
                  <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />
                  Expand search with AI
                </Button>
                <InfoTip>
                  AI uses your business description to suggest relevant names, then checks each recommendation live.
                </InfoTip>
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

function AiSearch({ id, config, active, focusToken, onBusy, onRegister }: PanelProps & { focusToken: number }) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [phase, setPhase] = useState<'idle' | 'thinking' | 'checking' | 'done'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [showTaken, setShowTaken] = useState(false);
  const busy = phase === 'thinking' || phase === 'checking';

  useEffect(() => {
    if (active) onBusy(busy);
  }, [active, busy, onBusy]);

  // Focus the description only when the tab was clicked or tapped (focusToken
  // changes), never on arrow-key tab switching, which must keep focus on the tab.
  useEffect(() => {
    if (focusToken) inputRef.current?.focus({ preventScroll: true });
  }, [focusToken]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function run(text: string) {
    const clean = text.trim();
    if (clean.length < 8) {
      setNotice('Tell us a little about the business. A sentence is plenty.');
      inputRef.current?.focus();
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
    setNotice(null);
    setRows(null);
    setEngine(null);
    setShowTaken(false);
    setPhase('thinking');
    trackEvent('domain_suggest', { length: clean.length });

    try {
      await streamNdjson(
        '/api/domains/suggest',
        { description: clean },
        (event) => {
          if (event.type === 'suggestions') {
            setEngine(event.engine);
            setRows(event.suggestions.map((s) => ({ domain: s.domain, status: 'checking', reason: s.reason })));
            setPhase('checking');
          } else if (event.type === 'result') {
            setRows((prev) => applyResult(prev, event.result));
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        },
        controller.signal,
      );
      setRows((prev) => {
        const settled = settle(prev);
        return settled ? [...settled].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : settled;
      });
      setPhase('done');
    } catch {
      if (controllerRef.current !== controller) return;
      // Anything still spinning won't get an answer now.
      setRows(settle);
      setNotice('We couldn’t reach the name generator just now. Try again, or search a name directly.');
      setPhase('idle');
    } finally {
      clearTimeout(timer);
    }
  }

  const open = rows?.filter((r) => r.status === 'available' || r.status === 'likely' || r.status === 'premium') ?? [];
  const unchecked = rows?.filter((r) => r.status === 'unknown') ?? [];
  const taken = rows?.filter((r) => r.status === 'taken') ?? [];
  const visible = phase === 'done' && !showTaken ? [...open, ...unchecked] : (rows ?? []);

  let progress: string | null = null;
  if (phase === 'thinking') progress = 'Brainstorming names for your business…';
  else if (phase === 'checking') progress = `Checking ${rows?.length ?? 0} names live…`;
  else if (phase === 'done' && rows) {
    const needCheck = unchecked.length ? ` ${unchecked.length} need a check on WRLD.host.` : '';
    progress = `${open.length} of ${rows.length} look open.${needCheck} Ideas by ${engineName(engine)}, checked live.`;
  }

  return (
    <>
      <form
        className="search-form"
        aria-label="Describe your business to get name ideas"
        onSubmit={(e) => {
          e.preventDefault();
          void run(description);
        }}
      >
        <label htmlFor={`${id}-describe`} className="sr-only">
          Describe your business
        </label>
        <div className="search-bar">
          <textarea
            ref={inputRef}
            id={`${id}-describe`}
            className="search-input"
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => {
              setDescription(e.target.value);
              if (notice) setNotice(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void run(description);
              }
            }}
            placeholder="What you do, who it’s for, and where. For example: family-owned HVAC company in Plano, TX."
          />
          <Button type="submit" variant="warm" className="btn-xl search-go" disabled={busy}>
            <RollText>{busy ? 'Thinking…' : 'Find names'}</RollText>
            <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>

        {notice ? (
          <p className="search-notice" role="alert">
            {notice}
          </p>
        ) : null}

        <div className="ai-examples" role="group" aria-label="Examples">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="ai-example"
              onClick={() => {
                setDescription(example);
                void run(example);
              }}
            >
              {example.split('.')[0]}
            </button>
          ))}
        </div>
      </form>

      {/* Persistent status region: present before the first update, so it's announced. */}
      <p className="search-progress" role="status">
        {progress ?? ''}
      </p>

      {visible.length ? <SearchResults rows={visible} config={config} onRegister={onRegister} /> : null}

      {phase === 'done' && taken.length ? (
        <button type="button" className="result-link results-note" onClick={() => setShowTaken((s) => !s)}>
          {showTaken ? 'Hide taken names' : `Show ${taken.length} taken name${taken.length > 1 ? 's' : ''}`}
        </button>
      ) : null}
    </>
  );
}
