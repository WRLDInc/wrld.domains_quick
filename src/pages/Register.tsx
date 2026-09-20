import { Link } from 'wouter';
import { Button } from '@/components/Button';
import { LINKS } from '@/lib/links';
import { usePageTitle } from '@/lib/usePageTitle';

export function RegisterPage() {
  usePageTitle('Create an account');

  return (
    <section className="handoff">
      <div className="container">
        <div className="handoff-card reveal">
          <div className="eyebrow">New account</div>
          <h1>Create your WRLD.host account.</h1>
          <p>
            One account covers domains, hosting, SSL, and support. Registration takes a couple of minutes on
            WRLD.host. You can also search for a domain first and create the account at checkout.
          </p>
          <div className="handoff-actions">
            <Button href={LINKS.createAccount} size="lg">
              Continue to WRLD.host <span className="arrow" aria-hidden="true">↗</span>
            </Button>
            <Button href="/" variant="ghost">
              Search domains first
            </Button>
          </div>
          <div className="handoff-foot">
            <span>
              Already have an account? <a href={LINKS.signIn}>Sign in ↗</a>
            </span>
            <Link href="/support">Questions? Get support</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
