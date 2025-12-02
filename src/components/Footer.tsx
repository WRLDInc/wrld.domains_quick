export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <h3 className="footer-title">
              <span className="gradient-text">WRLD</span>.domains
            </h3>
            <p className="footer-description">
              Fast, secure domain registration powered by WRLD.host
            </p>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Quick Links</h4>
            <ul className="footer-links">
              <li><a href="/">Search Domains</a></li>
              <li><a href="/login">Login</a></li>
              <li><a href="/register">Register</a></li>
              <li><a href="/support">Support</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Services</h4>
            <ul className="footer-links">
              <li><a href="https://wrld.host" target="_blank" rel="noopener noreferrer">Web Hosting</a></li>
              <li><a href="https://wrld.host" target="_blank" rel="noopener noreferrer">VPS Hosting</a></li>
              <li><a href="https://wrld.host" target="_blank" rel="noopener noreferrer">Dedicated Servers</a></li>
              <li><a href="https://wrld.host" target="_blank" rel="noopener noreferrer">Cloud Services</a></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-heading">Support</h4>
            <ul className="footer-links">
              <li><a href="/support">Contact Us</a></li>
              <li><a href="https://wrld.host/knowledgebase.php" target="_blank" rel="noopener noreferrer">Knowledge Base</a></li>
              <li><a href="https://wrld.host/serverstatus.php" target="_blank" rel="noopener noreferrer">Network Status</a></li>
              <li><a href="https://wrld.host/announcements.php" target="_blank" rel="noopener noreferrer">Announcements</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copyright">
            © {currentYear} WRLD Inc. All rights reserved.
          </p>
          <div className="footer-legal">
            <a href="https://wrld.host/tos.php" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            <span className="separator">•</span>
            <a href="https://wrld.host/privacy.php" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </div>
        </div>
      </div>

      <style>{`
        .footer {
          background: var(--color-bg-elevated);
          border-top: 1px solid var(--color-border);
          padding: 4rem 0 2rem;
          margin-top: auto;
        }

        .footer-content {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 3rem;
          margin-bottom: 3rem;
        }

        .footer-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .footer-title {
          font-size: 1.5rem;
          font-weight: 900;
          margin-bottom: 0.5rem;
        }

        .footer-description {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          line-height: 1.6;
        }

        .footer-heading {
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-primary);
          margin-bottom: 0.5rem;
        }

        .footer-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .footer-links a {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          transition: color var(--transition-fast);
        }

        .footer-links a:hover {
          color: var(--color-primary);
        }

        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 2rem;
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
          gap: 1rem;
        }

        .footer-copyright {
          color: var(--color-text-tertiary);
          font-size: 0.875rem;
        }

        .footer-legal {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
        }

        .footer-legal a {
          color: var(--color-text-secondary);
          transition: color var(--transition-fast);
        }

        .footer-legal a:hover {
          color: var(--color-primary);
        }

        .separator {
          color: var(--color-text-tertiary);
        }

        @media (max-width: 768px) {
          .footer {
            padding: 3rem 0 1.5rem;
          }

          .footer-content {
            grid-template-columns: 1fr;
            gap: 2rem;
          }

          .footer-bottom {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}
