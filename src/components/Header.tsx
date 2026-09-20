import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';
import { Lockup } from './Lockup';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './Button';
import { LINKS } from '@/lib/links';

interface NavItem {
  id: string;
  label: string;
  href: string;
  external?: boolean;
}

const NAV: NavItem[] = [
  { id: 'search', label: 'Search', href: '/' },
  { id: 'transfer', label: 'Transfer', href: LINKS.transferDomain, external: true },
  { id: 'support', label: 'Support', href: '/support' },
];

/**
 * Sticky 64px top nav after ui_kits/wrld-tech/Header.jsx: lockup left,
 * uppercase micro-labels centre with a single traveling underline, actions
 * right. Collapses to a drawer under 900px.
 */
export function Header() {
  const [location, navigate] = useLocation();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const activeId = NAV.find((n) => !n.external && n.href === location)?.id ?? null;
  const targetId = hoverId ?? activeId;

  const measure = useCallback(() => {
    const el = targetId ? itemRefs.current[targetId] : null;
    const nav = navRef.current;
    if (!el || !nav) {
      setIndicator((s) => ({ ...s, opacity: 0 }));
      return;
    }
    const er = el.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    setIndicator({ left: er.left - nr.left, width: er.width, opacity: 1 });
  }, [targetId]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    window.addEventListener('resize', measure);
    // Label widths change once Montserrat/Ubuntu land.
    document.fonts?.ready.then(() => measure()).catch(() => undefined);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    setOpen(false);
  }, [location]);

  const internal = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href);
  };

  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="/" className="lockup-link" onClick={internal('/')} aria-label="WRLD.domains home">
          <Lockup sub="DOMAINS" size={18} />
        </a>

        <nav ref={navRef} className="nav" aria-label="Primary" onMouseLeave={() => setHoverId(null)}>
          <span
            aria-hidden="true"
            className="nav-indicator"
            style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
          />
          {NAV.map((item) => (
            <a
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              href={item.href}
              className="nav-item"
              aria-current={activeId === item.id ? 'page' : undefined}
              onMouseEnter={() => setHoverId(item.id)}
              onFocus={() => setHoverId(item.id)}
              onBlur={() => setHoverId(null)}
              onClick={item.external ? undefined : internal(item.href)}
            >
              {item.label}
              {item.external ? <span className="arrow" aria-hidden="true">↗</span> : null}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Button href={LINKS.clientArea} variant="secondary">
            Client area <span className="arrow" aria-hidden="true">↗</span>
          </Button>
          <Button href={LINKS.signIn} variant="primary">
            Sign in
          </Button>
          <button
            type="button"
            className="menu-btn"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={16} strokeWidth={1.5} aria-hidden="true" /> : <Menu size={16} strokeWidth={1.5} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <div id="mobile-nav" className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="container drawer-inner">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="drawer-link"
              aria-current={activeId === item.id ? 'page' : undefined}
              onClick={item.external ? undefined : internal(item.href)}
              tabIndex={open ? 0 : -1}
            >
              <span>{item.label}</span>
              {item.external ? <span className="meta">wrld.host ↗</span> : null}
            </a>
          ))}
          <div className="drawer-actions">
            <Button href={LINKS.clientArea} variant="secondary" tabIndex={open ? 0 : -1}>
              Client area ↗
            </Button>
            <Button href={LINKS.signIn} tabIndex={open ? 0 : -1}>
              Sign in
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
