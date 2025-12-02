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
            <span className="gradient-text animated-gradient">Domain Name</span>
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
            {[
              { icon: '⚡', text: 'Instant Search' },
              { icon: '🔒', text: 'Secure Registration' },
              { icon: '💰', text: 'Competitive Pricing' }
            ].map((feature, index) => (
              <motion.div
                key={feature.text}
                className="feature-item"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1, type: 'spring', stiffness: 200 }}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
              >
                <motion.span
                  className="feature-icon"
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ delay: 1 + index * 0.2, duration: 0.5 }}
                >
                  {feature.icon}
                </motion.span>
                <span className="feature-text">{feature.text}</span>
              </motion.div>
            ))}
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

        .animated-gradient {
          background: linear-gradient(
            90deg,
            var(--color-primary),
            var(--color-accent),
            var(--color-primary-light),
            var(--color-accent-light),
            var(--color-primary)
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradient-shift 3s ease infinite;
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
          padding: 1.5rem;
          border-radius: 1rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          cursor: pointer;
          transition: all var(--transition-base);
        }

        .feature-item:hover {
          border-color: var(--color-primary);
          box-shadow: var(--shadow-lg), var(--glow-primary);
          background: var(--color-bg-hover);
        }

        .feature-icon {
          font-size: 2.5rem;
          filter: grayscale(0);
          transition: transform var(--transition-base);
        }

        .feature-item:hover .feature-icon {
          transform: scale(1.2);
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
