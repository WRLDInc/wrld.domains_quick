import { useState } from 'react';
import { motion } from 'framer-motion';

const POPULAR_TLDS = ['.com', '.net', '.org', '.io', '.dev', '.app', '.tech', '.ai'];

export function DomainSearch() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="domain-search">
      {/* WHMCS Integration: Direct form submission to cart.php */}
      <motion.form
        action="https://wrld.host/cart.php?a=add&domain=register"
        method="post"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="search-form"
      >
        <div className="search-input-wrapper">
          <input
            type="text"
            name="query"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter your domain name..."
            className="search-input"
          />
          <button
            type="submit"
            className="search-button"
            disabled={!searchTerm.trim()}
          >
            Search
          </button>
        </div>
        <div className="tld-suggestions">
          {POPULAR_TLDS.map((tld, index) => (
            <motion.button
              key={tld}
              type="button"
              className="tld-chip"
              onClick={() => {
                const cleanTerm = searchTerm.replace(/\.[a-z]+$/i, '');
                setSearchTerm(`${cleanTerm}${tld}`);
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 + index * 0.05, type: 'spring', stiffness: 300 }}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              {tld}
            </motion.button>
          ))}
        </div>
      </motion.form>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="search-info"
      >
        <p>Search for your perfect domain and check availability instantly at WRLD.host</p>
      </motion.div>

      <style>{`
        .domain-search {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }

        .search-form {
          margin-bottom: 2rem;
        }

        .search-input-wrapper {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .search-input {
          flex: 1;
          padding: 1rem 1.5rem;
          font-size: 1.125rem;
          border-radius: 0.75rem;
          border: 2px solid var(--color-border);
          background: var(--color-bg-card);
          color: var(--color-text-primary);
          transition: all var(--transition-base);
        }

        .search-input:focus {
          border-color: var(--color-primary);
          box-shadow: var(--glow-primary);
        }

        .search-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .search-button {
          padding: 1rem 2.5rem;
          font-size: 1.125rem;
          font-weight: 600;
          border-radius: 0.75rem;
          background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
          color: white;
          transition: all var(--transition-base);
          box-shadow: var(--shadow-md);
          min-width: 120px;
        }

        .search-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg), var(--glow-primary);
        }

        .search-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .search-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tld-suggestions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tld-chip {
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          font-weight: 500;
          font-family: var(--font-mono);
          border-radius: 0.5rem;
          background: var(--color-bg-elevated);
          color: var(--color-text-secondary);
          border: 1px solid var(--color-border);
          transition: all var(--transition-fast);
        }

        .tld-chip:hover {
          background: var(--color-bg-card);
          color: var(--color-primary);
          border-color: var(--color-primary);
        }

        .search-info {
          text-align: center;
          padding: 1.5rem;
          border-radius: 0.75rem;
          background: var(--color-bg-elevated);
          border: 1px solid var(--color-border);
        }

        .search-info p {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .search-input-wrapper {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
