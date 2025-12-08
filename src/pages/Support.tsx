import { motion } from 'framer-motion';
import { openGleap, openHelpCenter } from '@/lib/gleap';

export function SupportPage() {
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
            <div className="support-options">
              <motion.div
                className="support-card primary"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="card-icon">💬</div>
                <h2>Live Chat</h2>
                <p>Get instant help from our support team. Available 24/7.</p>
                <button onClick={openGleap} className="support-button primary">
                  Start Live Chat
                </button>
              </motion.div>

              <motion.div
                className="support-card"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="card-icon">📚</div>
                <h2>Help Center</h2>
                <p>Browse our knowledge base for answers to common questions.</p>
                <button onClick={openHelpCenter} className="support-button">
                  Browse Help Center
                </button>
              </motion.div>

              <motion.div
                className="support-card"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="card-icon">🎫</div>
                <h2>Submit a Ticket</h2>
                <p>Create a support ticket for detailed assistance.</p>
                <a href="https://wrld.host/submitticket.php" className="support-button" target="_blank" rel="noopener noreferrer">
                  Open Ticket
                </a>
              </motion.div>

              <motion.div
                className="support-card"
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="card-icon">👤</div>
                <h2>Client Area</h2>
                <p>Manage your services, domains, and billing.</p>
                <a href="https://wrld.host/clientarea.php" className="support-button" target="_blank" rel="noopener noreferrer">
                  Go to Client Area
                </a>
              </motion.div>
            </div>

            <div className="support-links">
              <h3>Quick Links</h3>
              <ul>
                <li><a href="https://wrld.host/knowledgebase.php" target="_blank" rel="noopener noreferrer">Knowledge Base</a></li>
                <li><a href="https://wrld.host/serverstatus.php" target="_blank" rel="noopener noreferrer">Network Status</a></li>
                <li><a href="https://wrld.host/announcements.php" target="_blank" rel="noopener noreferrer">Announcements</a></li>
              </ul>
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
          display: flex;
          flex-direction: column;
          gap: 3rem;
        }

        .support-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .support-card {
          padding: 2rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          text-align: center;
          cursor: pointer;
        }

        .support-card.primary {
          border-color: var(--color-primary);
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(14, 165, 233, 0.05));
        }

        .card-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .support-card h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 0.75rem;
        }

        .support-card p {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          line-height: 1.6;
          margin-bottom: 1.5rem;
        }

        .support-button {
          display: inline-block;
          padding: 0.75rem 1.5rem;
          font-weight: 600;
          font-size: 0.875rem;
          border-radius: 0.5rem;
          background: var(--color-bg-elevated);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border);
          transition: all var(--transition-base);
          text-decoration: none;
        }

        .support-button:hover {
          background: var(--color-bg-hover);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .support-button.primary {
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          border: none;
        }

        .support-button.primary:hover {
          box-shadow: var(--shadow-md), var(--glow-primary);
          color: white;
        }

        .support-links {
          padding: 2rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 1rem;
          text-align: center;
        }

        .support-links h3 {
          font-size: 1rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: var(--color-text-secondary);
        }

        .support-links ul {
          list-style: none;
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 2rem;
        }

        .support-links a {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          transition: color var(--transition-fast);
        }

        .support-links a:hover {
          color: var(--color-primary);
        }

        @media (max-width: 768px) {
          .support-page {
            padding: 2rem 0 4rem;
          }

          .support-header {
            margin-bottom: 2rem;
          }

          .support-links ul {
            flex-direction: column;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
