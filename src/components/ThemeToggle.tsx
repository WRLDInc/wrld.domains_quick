import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Check for saved theme preference or default to dark
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <motion.button
      onClick={toggleTheme}
      className="theme-toggle"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{
          rotate: theme === 'dark' ? 0 : 180,
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        {theme === 'dark' ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 2.5V4.5M10 15.5V17.5M17.5 10H15.5M4.5 10H2.5M15.3033 15.3033L13.8891 13.8891M6.11091 6.11091L4.69671 4.69671M15.3033 4.69671L13.8891 6.11091M6.11091 13.8891L4.69671 15.3033"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M17.2929 13.2929C16.2885 13.7474 15.1738 14 14 14C9.58172 14 6 10.4183 6 6C6 4.82616 6.25258 3.71154 6.70711 2.70711C4.09888 3.82434 2.25 6.60879 2.25 9.83333C2.25 14.0655 5.68451 17.5 9.91667 17.5C13.1412 17.5 15.9257 15.6511 17.2929 13.2929Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </motion.div>

      <style>{`
        .theme-toggle {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all var(--transition-base);
          overflow: hidden;
        }

        .theme-toggle::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
          opacity: 0;
          transition: opacity var(--transition-base);
        }

        .theme-toggle:hover::before {
          opacity: 0.1;
        }

        .theme-toggle:hover {
          border-color: var(--color-primary);
          box-shadow: var(--glow-primary);
        }

        .theme-toggle svg {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </motion.button>
  );
}
