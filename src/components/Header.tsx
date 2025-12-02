import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="header"
    >
      <div className="container">
        <div className="header-content">
          <Link href="/" className="logo">
            <motion.span
              className="logo-text gradient-text"
              whileHover={{ scale: 1.05 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              WRLD
            </motion.span>
            <span className="logo-domain">.domains</span>
          </Link>

          <nav className="nav">
            <Link href="/login" className="nav-link">
              Login
            </Link>
            <Link href="/register" className="nav-link">
              Register
            </Link>
            <Link href="/support" className="nav-link">
              Support
            </Link>
            <ThemeToggle />
            <a
              href="https://wrld.host"
              className="nav-link-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              WRLD.host →
            </a>
          </nav>
        </div>
      </div>

      <style>{`
        .header {
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--color-border);
          backdrop-filter: blur(12px) saturate(180%);
          background: var(--color-bg);
        }

        [data-theme="dark"] .header {
          background: rgba(10, 10, 10, 0.8);
        }

        [data-theme="light"] .header {
          background: rgba(255, 255, 255, 0.8);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 0;
        }

        .logo {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          font-weight: 900;
          font-size: 1.75rem;
          letter-spacing: -0.03em;
          transition: all var(--transition-base);
        }

        .logo:hover {
          transform: translateY(-2px);
        }

        .logo-text {
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .logo-domain {
          color: var(--color-text-primary);
          font-weight: 700;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .nav-link {
          color: var(--color-text-secondary);
          font-weight: 500;
          transition: color var(--transition-fast);
          position: relative;
        }

        .nav-link:hover {
          color: var(--color-text-primary);
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--color-primary);
          transition: width var(--transition-base);
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .nav-link-cta {
          padding: 0.625rem 1.5rem;
          font-weight: 600;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
          box-shadow: var(--shadow-sm);
        }

        .nav-link-cta:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-primary);
        }

        @media (max-width: 768px) {
          .header-content {
            padding: 1rem 0;
          }

          .logo {
            font-size: 1.5rem;
          }

          .nav {
            gap: 1rem;
          }

          .nav-link {
            display: none;
          }

          .nav-link-cta {
            display: block;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
          }
        }
      `}</style>
    </motion.header>
  );
}
