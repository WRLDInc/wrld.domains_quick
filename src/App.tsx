import { useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { HomePage } from '@/pages/Home';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { SupportPage } from '@/pages/Support';
import { CheckoutSuccessPage } from '@/pages/CheckoutSuccess';
import { LookSwitcher } from '@/components/LookSwitcher';
import { usePageTitle } from '@/lib/usePageTitle';

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location]);
  return null;
}

export function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ScrollToTop />
      <Header />
      <main id="main" tabIndex={-1}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/checkout/success" component={CheckoutSuccessPage} />
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </main>
      <Footer />
      <LookSwitcher />
    </>
  );
}

function NotFound() {
  usePageTitle('Page not found', { canonical: false });

  return (
    <section className="not-found">
      <div className="container">
        <div className="eyebrow">404</div>
        <h1>That page isn’t here.</h1>
        <p>
          The address may have moved, or it never existed. The domain you’re after might still be available,
          though.
        </p>
        <div className="handoff-actions">
          <Button href="/" size="lg">
            Search domains
          </Button>
          <Button href="/support" variant="ghost">
            Get support
          </Button>
        </div>
      </div>
    </section>
  );
}
