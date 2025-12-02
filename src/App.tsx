import { Route, Switch } from 'wouter';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { HomePage } from '@/pages/Home';
import { LoginPage } from '@/pages/Login';
import { RegisterPage } from '@/pages/Register';
import { SupportPage } from '@/pages/Support';

export function App() {
  return (
    <>
      <Header />
      <main className="main-content">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/support" component={SupportPage} />
          <Route>
            <NotFound />
          </Route>
        </Switch>
      </main>
      <Footer />

      <style>{`
        .main-content {
          flex: 1;
          min-height: calc(100vh - 400px);
        }
      `}</style>
    </>
  );
}

function NotFound() {
  return (
    <div className="not-found">
      <div className="container">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/" className="home-link">Go Home</a>
      </div>

      <style>{`
        .not-found {
          padding: 6rem 0;
          text-align: center;
        }

        .not-found h1 {
          font-size: 6rem;
          font-weight: 900;
          margin-bottom: 1rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .not-found p {
          font-size: 1.5rem;
          color: var(--color-text-secondary);
          margin-bottom: 2rem;
        }

        .home-link {
          display: inline-block;
          padding: 0.875rem 2rem;
          font-weight: 600;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
        }

        .home-link:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-primary);
        }
      `}</style>
    </div>
  );
}
