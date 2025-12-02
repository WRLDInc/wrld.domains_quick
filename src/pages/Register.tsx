import { motion } from 'framer-motion';

export function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-card"
        >
          <h1 className="auth-title">
            Join <span className="gradient-text">WRLD</span>
          </h1>
          <p className="auth-subtitle">Create your account at WRLD.host to get started</p>

          <div className="redirect-notice">
            <p>
              Registration is managed through our main platform at WRLD.host.
              You'll be redirected to complete your registration securely.
            </p>
          </div>

          <a
            href="https://wrld.host/register.php"
            className="submit-button"
          >
            Continue to Registration →
          </a>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <a href="/login" className="auth-link">Login here</a>
            </p>
          </div>
        </motion.div>
      </div>

      <style>{`
        .auth-page {
          padding: 4rem 0 6rem;
          min-height: calc(100vh - 400px);
          display: flex;
          align-items: center;
        }

        .auth-card {
          max-width: 480px;
          margin: 0 auto;
          padding: 3rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          box-shadow: var(--shadow-xl);
        }

        .auth-title {
          font-size: 2rem;
          font-weight: 900;
          text-align: center;
          margin-bottom: 0.5rem;
        }

        .auth-subtitle {
          text-align: center;
          color: var(--color-text-secondary);
          margin-bottom: 2rem;
        }

        .redirect-notice {
          padding: 1.5rem;
          border-radius: 0.75rem;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
          margin-bottom: 2rem;
        }

        .redirect-notice p {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          line-height: 1.6;
          text-align: center;
        }

        .submit-button {
          display: block;
          width: 100%;
          padding: 1rem;
          font-weight: 600;
          text-align: center;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
        }

        .submit-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-primary);
        }

        .auth-footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--color-border);
          text-align: center;
          font-size: 0.875rem;
        }

        .auth-footer p {
          color: var(--color-text-secondary);
        }

        .auth-link {
          color: var(--color-primary);
          font-weight: 600;
        }

        .auth-link:hover {
          color: var(--color-primary-light);
        }

        @media (max-width: 768px) {
          .auth-page {
            padding: 2rem 0 4rem;
          }

          .auth-card {
            padding: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
