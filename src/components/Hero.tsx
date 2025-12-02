import { motion } from 'framer-motion';

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-background grid-pattern" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="hero-content"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.7 }}
            className="hero-title"
          >
            Find Your Perfect
            <br />
            <span className="gradient-text">Domain Name</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="hero-subtitle"
          >
            Lightning-fast domain search powered by WRLD.host.
            <br />
            Secure your online presence in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="hero-features"
          >
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Instant Search</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Secure Registration</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💰</span>
              <span className="feature-text">Competitive Pricing</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      <style>{`
        .hero {
          position: relative;
          padding: 4rem 0 6rem;
          overflow: hidden;
        }

        .hero-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          opacity: 0.03;
          pointer-events: none;
        }

        .hero-content {
          position: relative;
          text-align: center;
          max-width: 900px;
          margin: 0 auto;
        }

        .hero-title {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: 1.5rem;
          letter-spacing: -0.03em;
        }

        .hero-subtitle {
          font-size: clamp(1.125rem, 2vw, 1.375rem);
          color: var(--color-text-secondary);
          margin-bottom: 3rem;
          line-height: 1.6;
        }

        .hero-features {
          display: flex;
          justify-content: center;
          gap: 3rem;
          flex-wrap: wrap;
          margin-bottom: 3rem;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .feature-icon {
          font-size: 2rem;
          filter: grayscale(0.3);
        }

        .feature-text {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @media (max-width: 768px) {
          .hero {
            padding: 3rem 0 4rem;
          }

          .hero-features {
            gap: 2rem;
          }

          .feature-icon {
            font-size: 1.5rem;
          }

          .feature-text {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </section>
  );
}
