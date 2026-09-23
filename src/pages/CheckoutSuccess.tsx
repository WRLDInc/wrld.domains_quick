import { useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { LINKS } from '@/lib/links';
import { usePageTitle } from '@/lib/usePageTitle';

type State = 'paid' | 'dry_run' | 'registering' | 'action_required' | 'registered' | 'needs_review' | 'failed' | 'unknown';

interface Status {
  state: State;
  domain?: string;
  livemode?: boolean;
}

const POLL_MS = 2_500;
const MAX_POLLS = 40;

const COPY: Record<State, { title: (d: string) => string; body: string }> = {
  paid: { title: (d) => `Registering ${d}…`, body: 'Payment received. We’re registering the name now; this usually takes under a minute.' },
  registering: { title: (d) => `Registering ${d}…`, body: 'The registry is still processing it. This page updates on its own while it finishes.' },
  registered: { title: (d) => `${d} is yours.`, body: 'Registration is complete. When you’re ready to point it at a site or email, open a ticket and we’ll set up DNS with you.' },
  action_required: { title: () => 'One more step: check your inbox.', body: 'The registry needs you to confirm the registrant email address. The link expires in 15 days.' },
  dry_run: { title: (d) => `Test order recorded for ${d}.`, body: 'This checkout ran in test mode. The payment was recorded and nothing was registered.' },
  needs_review: { title: (d) => `We’re finishing ${d} by hand.`, body: 'Something needs a person to look at it before we register. Our team has been notified and will reach out shortly; if we can’t complete it, you get a full refund.' },
  failed: { title: (d) => `We couldn’t register ${d}.`, body: 'The registry turned the request down. Our team has been notified and will reach out with options, including a full refund.' },
  unknown: { title: () => 'We couldn’t find that order.', body: 'If you completed a payment, open a ticket and we’ll sort it out.' },
};

/** /checkout/success?session_id=cs_… — polls the order until it settles. */
export function CheckoutSuccessPage() {
  usePageTitle('Order status', { canonical: false });
  const [status, setStatus] = useState<Status>({ state: 'paid' });

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id') ?? '';
    if (!sessionId) {
      setStatus({ state: 'unknown' });
      return;
    }
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const poll = async () => {
      polls += 1;
      try {
        const res = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`);
        const data = (await res.json()) as { result?: string } & Partial<Status>;
        if (cancelled) return;
        if (res.status === 400) {
          setStatus({ state: 'unknown' });
          return;
        }
        const next: Status = { state: (data.state as State) ?? 'paid', domain: data.domain, livemode: data.livemode };
        setStatus(next);
        const settled = !['paid', 'registering'].includes(next.state);
        if (!settled && polls < MAX_POLLS) timer = setTimeout(poll, POLL_MS);
      } catch {
        if (!cancelled && polls < MAX_POLLS) timer = setTimeout(poll, POLL_MS);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const copy = COPY[status.state];
  const domain = status.domain ?? 'your domain';

  return (
    <section className="handoff" aria-labelledby="order-title">
      <div className="container">
        <div className="handoff-card">
          <div className="eyebrow">Order status{status.livemode === false ? ' · test mode' : ''}</div>
          <h1 id="order-title">{copy.title(domain)}</h1>
          <p>{copy.body}</p>
          <div className="handoff-actions">
            <Button href="/" size="lg">
              Search another name
            </Button>
            <Button href={LINKS.openTicket} variant="ghost">
              Open a ticket ↗
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
