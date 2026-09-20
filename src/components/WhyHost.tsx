import { Anchor } from './Anchor';
import { LINKS } from '@/lib/links';

const REASONS = [
  {
    tag: 'registry',
    title: 'Direct platform access',
    body: 'No sub-channel resellers between you and your domain. You hold the registrant contact; we run the platform.',
    href: LINKS.host,
    foot: 'wrld.host',
  },
  {
    tag: 'dns',
    title: 'DNS where your hosting is',
    body: 'Nameservers, records, and SSL sit in the same client area as your hosting, so a change is one sign-in, not three.',
    href: LINKS.clientArea,
    foot: 'wrld.host/clientarea.php',
  },
  {
    tag: 'transfers',
    title: 'Transfers in and out',
    body: 'Bring a domain in with its authorization code, or move one out when your plans change. Standard transfer rules apply.',
    href: LINKS.transferDomain,
    foot: 'wrld.host/cart.php',
  },
  {
    tag: 'support',
    title: 'Real humans on every ticket',
    body: 'Open a ticket and a person answers, with your hosting already in front of them.',
    href: '/support',
    foot: 'wrld.domains/support',
  },
];

/** Cards after preview/components-cards.html: hairline border, 8px radius, accent shadow on hover only. */
export function WhyHost() {
  return (
    <section className="section" aria-labelledby="why-title">
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow">Why WRLD.host</div>
            <h2 id="why-title" className="section-title">
              Hosting chosen deliberately. Domains to match.
            </h2>
          </div>
          <p className="lede">
            Fast by default, no noisy neighbors, and the specs in plain sight. Your domain gets the same
            treatment as everything else on the platform.
          </p>
        </div>
        <div className="cards">
          {REASONS.map((reason) => (
            <Anchor key={reason.tag} href={reason.href} className="card">
              <div className="card-tag">{reason.tag}</div>
              <h3 className="card-title">{reason.title}</h3>
              <p className="card-body">{reason.body}</p>
              <div className="card-foot">
                <span>{reason.foot}</span>
                <span aria-hidden="true">→</span>
              </div>
            </Anchor>
          ))}
        </div>
      </div>
    </section>
  );
}
