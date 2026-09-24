import { DomainSearch } from './DomainSearch';
import { LiveBadge } from './LiveBadge';
import { TopoField } from './TopoField';

/**
 * After ui_kits/wrld-tech/Hero.jsx, reordered so the search is the one hero
 * element and clears the fold on a 320px phone: eyebrow and live badge, the
 * headline, the search console, then the supporting lede. The topographic
 * field behind it carries the "address" idea: a domain is a place on a map.
 */
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <TopoField className="hero-topo" />
      <div className="container hero-inner">
        <div className="hero-top reveal">
          <div className="eyebrow">WRLD.host · Domains</div>
          <LiveBadge />
        </div>
        <h1 id="hero-title" className="hero-title reveal reveal-1">
          Your digital address. Registered where it lives.
        </h1>
        <div className="reveal reveal-2">
          <DomainSearch />
        </div>
        <p className="hero-lede reveal reveal-3">
          A domain is where people find you. Check it live across the TLDs that matter, or describe your business and
          we’ll suggest names that are actually open. Register on WRLD.host, the same platform that hosts your site.
          Direct platform access, no predatory upsells, and real humans answering tickets.
        </p>
      </div>
    </section>
  );
}
