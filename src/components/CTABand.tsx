import { Button } from './Button';
import { RollText } from './RollText';
import { LINKS } from '@/lib/links';

/** Closing band after ui_kits/wrld-tech/CTA.jsx, inverted against the current theme. */
export function CTABand() {
  return (
    <section className="cta" aria-labelledby="cta-title">
      <div className="container">
        <div className="cta-band">
          <div>
            <div className="eyebrow">Beyond domains</div>
            <h2 id="cta-title">Hosting chosen deliberately.</h2>
            <p>
              WRLD.host is a clustered, ethically-operated platform reserved for WRLD clients and approved
              partners. Fast by default, no noisy neighbors, and a team that answers.
            </p>
          </div>
          <div className="cta-actions">
            <Button href={LINKS.host} variant="inverse" size="lg">
              <RollText>Explore WRLD.host</RollText> <span className="arrow" aria-hidden="true">↗</span>
            </Button>
            <Button href={LINKS.contact} variant="ghost-inverse">
              Start a conversation
            </Button>
            <a className="meta" href={LINKS.email}>
              ridge@wrld.tech · Dallas, TX
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
