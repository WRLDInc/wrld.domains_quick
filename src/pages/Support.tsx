import { useState } from 'react';
import { motion } from 'framer-motion';

export function SupportPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });

      const data = await response.json();

      if (data.result === 'success') {
        setSubmitStatus('success');
        setName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        setSubmitStatus('error');
      }
    } catch (err) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="support-page">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="support-content"
        >
          <div className="support-header">
            <h1>Get Support</h1>
            <p>Our team is here to help you 24/7</p>
          </div>

          <div className="support-grid">
            <div className="support-form-section">
              <h2>Submit a Ticket</h2>

              {submitStatus === 'success' && (
                <div className="success-message">
                  Your ticket has been submitted successfully! We'll get back to you soon.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="error-message">
                  Failed to submit ticket. Please try again or contact us directly.
                </div>
              )}

              <form onSubmit={handleSubmit} className="support-form">
                <div className="form-group">
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="form-input"
                    placeholder="Your name"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="form-input"
                    placeholder="you@example.com"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject" className="form-label">Subject</label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    className="form-input"
                    placeholder="How can we help?"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="message" className="form-label">Message</label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    className="form-textarea"
                    placeholder="Describe your issue or question..."
                    rows={6}
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </form>
            </div>

            <div className="support-info">
              <div className="info-card">
                <h3>Quick Links</h3>
                <ul className="info-links">
                  <li>
                    <a href="https://wrld.host/knowledgebase.php" target="_blank" rel="noopener noreferrer">
                      Knowledge Base
                    </a>
                  </li>
                  <li>
                    <a href="https://wrld.host/serverstatus.php" target="_blank" rel="noopener noreferrer">
                      Network Status
                    </a>
                  </li>
                  <li>
                    <a href="https://wrld.host/announcements.php" target="_blank" rel="noopener noreferrer">
                      Announcements
                    </a>
                  </li>
                  <li>
                    <a href="https://wrld.host/contact.php" target="_blank" rel="noopener noreferrer">
                      Contact Information
                    </a>
                  </li>
                </ul>
              </div>

              <div className="info-card">
                <h3>Existing Customers</h3>
                <p>
                  If you already have an account, you can manage your tickets
                  through the client area.
                </p>
                <a
                  href="https://wrld.host/clientarea.php"
                  className="info-button"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Go to Client Area →
                </a>
              </div>

              <div className="info-card">
                <h3>Live Chat</h3>
                <p>
                  Need immediate assistance? Our live chat support is available 24/7.
                </p>
                <a
                  href="https://wrld.host/submitticket.php"
                  className="info-button"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Start Live Chat →
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        .support-page {
          padding: 4rem 0 6rem;
          min-height: calc(100vh - 400px);
        }

        .support-header {
          text-align: center;
          margin-bottom: 4rem;
        }

        .support-header h1 {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 900;
          margin-bottom: 1rem;
        }

        .support-header p {
          font-size: 1.25rem;
          color: var(--color-text-secondary);
        }

        .support-grid {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 3rem;
          align-items: start;
        }

        .support-form-section h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-bottom: 1.5rem;
        }

        .support-form {
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

        .form-input,
        .form-textarea {
          width: 100%;
        }

        .form-textarea {
          resize: vertical;
          min-height: 120px;
          font-family: var(--font-sans);
        }

        .submit-button {
          width: 100%;
          padding: 1rem;
          font-weight: 600;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-primary);
        }

        .submit-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .success-message {
          padding: 1rem;
          border-radius: 0.5rem;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid var(--color-success);
          color: var(--color-success);
          margin-bottom: 1.5rem;
          font-size: 0.875rem;
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

        .support-info {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .info-card {
          padding: 1.5rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 0.75rem;
        }

        .info-card h3 {
          font-size: 1.125rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .info-card p {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .info-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .info-links a {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          transition: color var(--transition-fast);
          display: block;
        }

        .info-links a:hover {
          color: var(--color-primary);
        }

        .info-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          border-radius: 0.5rem;
          background: var(--color-bg-elevated);
          color: var(--color-primary);
          border: 1px solid var(--color-border);
          transition: all var(--transition-base);
        }

        .info-button:hover {
          background: var(--color-bg-hover);
          border-color: var(--color-primary);
          transform: translateY(-2px);
        }

        @media (max-width: 1024px) {
          .support-grid {
            grid-template-columns: 1fr;
          }

          .support-info {
            order: 2;
          }
        }

        @media (max-width: 768px) {
          .support-page {
            padding: 2rem 0 4rem;
          }

          .support-header {
            margin-bottom: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
