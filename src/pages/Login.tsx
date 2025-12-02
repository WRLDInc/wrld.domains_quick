import { useState } from 'react';
import { motion } from 'framer-motion';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.result === 'success') {
        window.location.href = 'https://wrld.host/clientarea.php';
      } else {
        setError(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="auth-card"
        >
          <h1 className="auth-title">
            Welcome to <span className="gradient-text">WRLD</span>
          </h1>
          <p className="auth-subtitle">Login to manage your domains and services</p>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                placeholder="••••••••"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <a href="/register" className="auth-link">Register here</a>
            </p>
            <a href="https://wrld.host/pwreset.php" className="auth-link">
              Forgot password?
            </a>
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

        .error-message {
          padding: 1rem;
          border-radius: 0.5rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-label {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--color-text-primary);
        }

        .form-input {
          width: 100%;
        }

        .submit-button {
          width: 100%;
          padding: 1rem;
          font-weight: 600;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
          margin-top: 0.5rem;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-primary);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-footer {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid var(--color-border);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 1rem;
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
