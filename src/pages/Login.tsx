import { Link } from 'wouter';
import { Button } from '@/components/Button';
import { LINKS } from '@/lib/links';
import { usePageTitle } from '@/lib/usePageTitle';

/**
 * Sign-in lives on wrld.host. WHMCS protects its login with a per-session
 * token, so a form here posting credentials cross-origin would be rejected,
 * and routing passwords through a second site is a bad idea regardless.
 * This page explains that and hands off.
 */
export function LoginPage() {
  usePageTitle('Sign in');

  return (
    <section className="handoff">
      <div className="container">
        <div className="handoff-card reveal">
          <div className="eyebrow">Client area</div>
          <h1>Sign in on WRLD.host.</h1>
          <p>
            Your domains, DNS, invoices, and tickets live in the WRLD.host client area. One account covers every
            WRLD.host service.
          </p>
          <div className="handoff-actions">
            <Button href={LINKS.signIn} size="lg">
              Continue to sign in <span className="arrow" aria-hidden="true">↗</span>
            </Button>
            <Button href={LINKS.resetPassword} variant="ghost">
              Forgot your password?
            </Button>
          </div>
          <p className="handoff-note">Sign-in happens on wrld.host, so your password never passes through this site.</p>
          <div className="handoff-foot">
            <span>
              New to WRLD? <Link href="/register">Create an account</Link>
            </span>
            <Link href="/support">Need a hand? Get support</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
