import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DomainCheckResult } from '@/types/whmcs';

const POPULAR_TLDS = ['.com', '.net', '.org', '.io', '.dev', '.app', '.tech', '.ai'];

export function DomainSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<DomainCheckResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const domainsToCheck = POPULAR_TLDS.map(tld => {
        const domain = searchTerm.toLowerCase().replace(/\s+/g, '');
        return domain.includes('.') ? domain : `${domain}${tld}`;
      });

      const response = await fetch('/api/domains/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: domainsToCheck }),
      });

      if (!response.ok) {
        throw new Error('Failed to check domain availability');
      }

      const data = await response.json();

      if (data.result === 'success') {
        const domainResults = Object.entries(data.domains).map(([domain, info]: [string, any]) => ({
          domain,
          status: info.status === 'available' ? 'available' : 'unavailable',
          price: info.price,
          period: info.period,
        }));
        setResults(domainResults);
      } else {
        setError(data.message || 'Failed to check domains');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePurchase = (domain: string) => {
    window.location.href = `https://wrld.host/cart.php?a=add&domain=register&query=${encodeURIComponent(domain)}`;
  };

  return (
    <div className="domain-search">
      <motion.form
        onSubmit={handleSearch}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="search-form"
      >
        <div className="search-input-wrapper">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter your domain name..."
            className="search-input"
            disabled={isSearching}
          />
          <button
            type="submit"
            className="search-button"
            disabled={isSearching || !searchTerm.trim()}
          >
            {isSearching ? (
              <span className="spinner" />
            ) : (
              'Search'
            )}
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

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="error-message"
        >
          {error}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {results.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="results-container"
          >
            {results.map((result, index) => (
              <motion.div
                key={result.domain}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`result-card ${result.status}`}
              >
                <div className="result-domain">
                  <span className="domain-name">{result.domain}</span>
                  <span className={`status-badge ${result.status}`}>
                    {result.status === 'available' ? '✓ Available' : '✗ Taken'}
                  </span>
                </div>
                {result.status === 'available' && (
                  <div className="result-actions">
                    {result.price && (
                      <span className="price">{result.price}</span>
                    )}
                    <button
                      onClick={() => handlePurchase(result.domain)}
                      className="purchase-button"
                    >
                      Register →
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

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

        .spinner {
          display: inline-block;
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
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

        .error-message {
          padding: 1rem 1.5rem;
          border-radius: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid var(--color-error);
          color: var(--color-error);
          margin-bottom: 1.5rem;
        }

        .results-container {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .result-card {
          padding: 1.25rem 1.5rem;
          border-radius: 0.75rem;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all var(--transition-base);
        }

        .result-card:hover {
          background: var(--color-bg-hover);
          transform: translateX(4px);
        }

        .result-card.available {
          border-left: 3px solid var(--color-success);
        }

        .result-card.unavailable {
          opacity: 0.7;
        }

        .result-domain {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .domain-name {
          font-family: var(--font-mono);
          font-size: 1.125rem;
          font-weight: 600;
        }

        .status-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-badge.available {
          background: rgba(34, 197, 94, 0.15);
          color: var(--color-success);
        }

        .status-badge.unavailable {
          background: rgba(115, 115, 115, 0.15);
          color: var(--color-text-tertiary);
        }

        .result-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .price {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-accent);
        }

        .purchase-button {
          padding: 0.625rem 1.5rem;
          font-weight: 600;
          border-radius: 0.5rem;
          background: linear-gradient(135deg, var(--color-accent), var(--color-accent-dark));
          color: white;
          transition: all var(--transition-base);
        }

        .purchase-button:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md), var(--glow-accent);
        }

        @media (max-width: 768px) {
          .search-input-wrapper {
            flex-direction: column;
          }

          .result-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }

          .result-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
