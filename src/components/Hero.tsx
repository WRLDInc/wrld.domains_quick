import { DomainSearch } from './DomainSearch';
import { TopoField } from './TopoField';

/**
 * After ui_kits/wrld-tech/Hero.jsx: eyebrow, display headline, lede, then the
 * one hero element (the search). The topographic field behind it carries the
 * "address" idea: a domain is a place on a map.
 */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <TopoField className="hero-topo" />
      <div className="container hero-inner">
        <div className="eyebrow reveal">WRLD.host · Domains</div>
        <h1 id="hero-title" className="hero-title reveal reveal-1">
          Your digital address. Registered where it lives.
        </h1>
        <p className="hero-lede reveal reveal-2">
          A domain is where people find you. Check availability across the TLDs that matter, then register on
          WRLD.host, the same platform that hosts your site. Direct platform access, no predatory upsells, and
          real humans answering tickets.
        </p>
        <div className="reveal reveal-3">
          <DomainSearch />
        </div>
      </div>
    </section>
  );
}
