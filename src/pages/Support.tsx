import { Anchor } from '@/components/Anchor';
import { LINKS } from '@/lib/links';
import { openGleap } from '@/lib/gleap';
import { usePageTitle } from '@/lib/usePageTitle';

interface Option {
  tag: string;
  title: string;
  body: string;
  foot: string;
  href?: string;
  onClick?: () => void;
}

const OPTIONS: Option[] = [
  {
    tag: 'chat',
    title: 'Chat with us',
    body: 'Open WRLD Help and talk to a person. Good for quick questions about a search, a transfer, or an order in progress.',
    foot: 'Opens here',
    onClick: openGleap,
  },
  {
    tag: 'ticket',
    title: 'Open a ticket',
    body: 'For anything that needs a record: DNS changes, transfer authorizations, billing. A person answers, and the thread lands in your client area.',
    foot: 'wrld.host/submitticket.php',
    href: LINKS.openTicket,
  },
  {
    tag: 'docs',
    title: 'Knowledge base',
    body: 'Step-by-step guides for nameservers, DNS records, transfers, and renewals on WRLD.host.',
    foot: 'wrld.host/knowledgebase',
    href: LINKS.knowledgeBase,
  },
  {
    tag: 'account',
    title: 'Client area',
    body: 'Manage domains, DNS, contacts, invoices, and existing tickets. Sign in with your WRLD.host account.',
    foot: 'wrld.host/clientarea.php',
    href: LINKS.clientArea,
  },
];

export function SupportPage() {
  usePageTitle('Support');

  return (
    <>
      <section className="page-head">
        <div className="container">
          <div className="eyebrow reveal">Support</div>
          <h1 className="reveal reveal-1">Get help with a domain.</h1>
          <p className="lede reveal reveal-2">
            Chat, open a ticket, or look it up yourself. Real humans on the other end of every ticket.
          </p>
        </div>
      </section>

      <section className="section" aria-label="Support options">
        <div className="container">
          <div className="cards">
            {OPTIONS.map((option) => {
              const inner = (
                <>
                  <div className="card-tag">{option.tag}</div>
                  <h2 className="card-title">{option.title}</h2>
                  <p className="card-body">{option.body}</p>
                  <div className="card-foot">
                    <span>{option.foot}</span>
                    <span aria-hidden="true">{option.href ? '↗' : '→'}</span>
                  </div>
                </>
              );
              return option.href ? (
                <Anchor key={option.tag} href={option.href} className="card">
                  {inner}
                </Anchor>
              ) : (
                <button key={option.tag} type="button" className="card" onClick={option.onClick}>
                  {inner}
                </button>
              );
            })}
          </div>

          <nav className="quick-links" aria-label="More from WRLD">
            <a href={LINKS.announcements}>Announcements ↗</a>
            <a href={LINKS.status}>Service status ↗</a>
            <a href={LINKS.contact}>Contact WRLD ↗</a>
            <a href={LINKS.email}>ridge@wrld.tech</a>
          </nav>
        </div>
      </section>
    </>
  );
}
