import { Anchor } from './Anchor';
import { Lockup } from './Lockup';
import { LINKS } from '@/lib/links';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Domains',
    links: [
      { label: 'Search', href: '/' },
      { label: 'Transfer a domain', href: LINKS.transferDomain, external: true },
      { label: 'Create an account', href: LINKS.createAccount, external: true },
      { label: 'Sign in', href: LINKS.signIn, external: true },
      { label: 'Support', href: '/support' },
    ],
  },
  {
    title: 'WRLD.host',
    links: [
      { label: 'Hosting', href: LINKS.host, external: true },
      { label: 'Client area', href: LINKS.clientArea, external: true },
      { label: 'Knowledge base', href: LINKS.knowledgeBase, external: true },
      { label: 'Announcements', href: LINKS.announcements, external: true },
      { label: 'Service status', href: LINKS.status, external: true },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'wrld.tech', href: LINKS.tech, external: true },
      { label: 'About', href: LINKS.about, external: true },
      { label: 'Contact', href: LINKS.contact, external: true },
      { label: 'Terms', href: LINKS.terms, external: true },
      { label: 'Privacy', href: LINKS.privacy, external: true },
    ],
  },
];

/** After ui_kits/wrld-tech/Footer.jsx: lockup + blurb, three link columns, mono legal line. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Lockup sub="DOMAINS" size={20} />
            <p className="footer-blurb">
              WRLD.domains is the domain front door for WRLD.host, the hosting platform run by WRLD Tech Co.,
              a DBA of WRLD Inc.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="footer-col">
              <div className="eyebrow">{col.title}</div>
              <div className="footer-links">
                {col.links.map((link) => (
                  <Anchor key={link.label} href={link.href}>
                    {link.label}
                    {link.external ? <span className="arrow" aria-hidden="true"> ↗</span> : null}
                  </Anchor>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="footer-legal">
          <span>© {year} WRLD Inc. · EIN 84-5122446 · Dallas, TX</span>
          <a href={LINKS.design}>Built on the WRLD design system ↗</a>
        </div>
      </div>
    </footer>
  );
}
